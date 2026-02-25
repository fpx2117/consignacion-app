import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SUBSCRIPTION_PLANS, PLAN_LIMITS_DEFAULTS } from "@/constants/subscriptions";
import { RolUsuario, ProveedorSuscripcion, EstadoSuscripcion } from "@prisma/client";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { paymentConfig } from "@/lib/paymentConfig";

const mpClient = new MercadoPagoConfig({
    accessToken: paymentConfig.mp.accessToken,
});

type InitializeBody = {
    admin: { nombre: string; email: string; password: string };
    planId: number;
    staff?: Array<{ nombre: string; email: string; password?: string }>;
    businessName?: string;
    promoCode?: string;
    paymentId?: string;
};

export async function POST(req: Request) {
    try {
        // 1) Security check: Only initialize if there are NO users
        const userCount = await prisma.usuario.count();
        if (userCount > 0) {
            return NextResponse.json(
                { message: "El sistema ya ha sido inicializado" },
                { status: 403 }
            );
        }

        const body = (await req.json()) as InitializeBody;
        const { admin, planId, staff, businessName, promoCode, paymentId } = body;

        if (!admin?.nombre || !admin?.email || !admin?.password) {
            return NextResponse.json({ message: "Faltan datos del administrador" }, { status: 400 });
        }

        // --- VERIFICATION LOGIC ---
        let verificationProvider: ProveedorSuscripcion = ProveedorSuscripcion.PROMO;
        let verificationExternalId = `SETUP-UNVERIFIED-${Date.now()}`;
        const verificationStatus = EstadoSuscripcion.ACTIVO;
        let trialDays = 30;
        let finalPlanId = planId;

        if (promoCode) {
            const promo = await prisma.promoCode.findUnique({
                where: { code: promoCode.toUpperCase() },
                include: { plan: true },
            });

            if (!promo || !promo.activo || promo.usedCount >= promo.maxUses) {
                return NextResponse.json(
                    { message: "La licencia es inválida o ya fue utilizada" },
                    { status: 400 }
                );
            }

            verificationProvider = ProveedorSuscripcion.PROMO;
            verificationExternalId = `PROMO-${promo.code}-${Date.now()}`;
            trialDays = promo.durationDays || 30;
            finalPlanId = promo.planId;

            await prisma.promoCode.update({
                where: { id: promo.id },
                data: { usedCount: { increment: 1 } },
            });
        } else if (paymentId) {
            const isPayPal = paymentId.startsWith("S-");

            if (isPayPal) {
                try {
                    const { getPayPalAccessToken } = await import("@/lib/paypal");
                    const accessToken = await getPayPalAccessToken();
                    const base = paymentConfig.paypal.apiUrl;

                    const response = await fetch(`${base}/v1/billing/subscriptions/${paymentId}`, {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            "Content-Type": "application/json",
                        },
                    });

                    if (!response.ok) {
                        return NextResponse.json(
                            { message: "No se pudo verificar la suscripción de PayPal" },
                            { status: 400 }
                        );
                    }

                    const subData = await response.json();
                    if (subData.status !== "ACTIVE") {
                        return NextResponse.json(
                            { message: `La suscripción de PayPal no está activa (Estado: ${subData.status})` },
                            { status: 400 }
                        );
                    }

                    verificationProvider = ProveedorSuscripcion.PAYPAL;
                    verificationExternalId = paymentId;
                    trialDays = 30;
                } catch (err) {
                    console.error("PayPal Verification Error:", err);
                    return NextResponse.json({ message: "Error verificando con PayPal" }, { status: 400 });
                }
            } else {
                try {
                    // 1) Intento como Payment (pago único)
                    const payment = new Payment(mpClient);

                    let verified = false;

                    try {
                        const paymentData = await payment.get({ id: paymentId });

                        if (paymentData?.status === "approved") {
                            verificationProvider = ProveedorSuscripcion.MERCADOPAGO;
                            verificationExternalId = String(paymentId);
                            trialDays = 30;
                            verified = true;
                        }
                    } catch {
                        // ignore -> try PreApproval
                    }

                    // 2) Si no fue pago único, intento como PreApproval (suscripción)
                    if (!verified) {
                        const { PreApproval } = await import("mercadopago");
                        const preApproval = new PreApproval(mpClient);
                        const subData = await preApproval.get({ id: paymentId });

                        if (subData?.status !== "authorized") {
                            return NextResponse.json(
                                {
                                    message: `La suscripción de Mercado Pago no está autorizada (Estado: ${subData?.status})`,
                                },
                                { status: 400 }
                            );
                        }

                        verificationProvider = ProveedorSuscripcion.MERCADOPAGO;
                        verificationExternalId = String(paymentId);
                        trialDays = 30;
                        verified = true;
                    }

                    if (!verified) {
                        return NextResponse.json(
                            { message: "El pago o suscripción no está aprobado" },
                            { status: 400 }
                        );
                    }
                } catch (err) {
                    console.error("MP Verification Error:", err);
                    return NextResponse.json(
                        { message: "No se pudo verificar con Mercado Pago" },
                        { status: 400 }
                    );
                }
            }
        } else {
            return NextResponse.json(
                { message: "Se requiere un pago o código promocional para activar el sistema" },
                { status: 402 }
            );
        }
        // --- END VERIFICATION ---

        const { fetchDolarBlue } = await import("@/lib/dolarBlue");
        const exchangeRate = await fetchDolarBlue();

        const result = await prisma.$transaction(async (tx) => {
            // 0) Ensure default Sucursal exists (FK default=1 relies on this)
            await tx.sucursal.upsert({
                where: { id: 1 },
                update: {},
                create: {
                    id: 1,
                    nombre: "Sucursal Principal",
                    esPrincipal: true,
                    activa: true,
                },
            });

            // a) Sync Plans and Limits
            for (const p of SUBSCRIPTION_PLANS) {
                const calculatedPrecioARS = p.precioUSD * exchangeRate;

                await tx.plan.upsert({
                    where: { id: p.id },
                    update: {
                        nombre: p.nombre,
                        descripcion: p.descripcion,
                        precioARS: calculatedPrecioARS,
                        precioUSD: p.precioUSD,
                        mercadopagoId: p.mercadopagoId,
                        paypalId: p.paypalId,
                        activo: true,
                    },
                    create: {
                        id: p.id,
                        nombre: p.nombre,
                        descripcion: p.descripcion,
                        precioARS: calculatedPrecioARS,
                        precioUSD: p.precioUSD,
                        mercadopagoId: p.mercadopagoId,
                        paypalId: p.paypalId,
                        activo: true,
                    },
                });

                const limits = PLAN_LIMITS_DEFAULTS[p.id];
                if (limits) {
                    await tx.planLimit.upsert({
                        where: { planId: p.id },
                        update: {
                            maxProductos: limits.maxProductos,
                            maxUsuarios: limits.maxUsuarios,
                            allowConsignaciones: limits.allowConsignaciones,
                            allowSucursales: limits.allowSucursales,
                        },
                        create: {
                            planId: p.id,
                            maxProductos: limits.maxProductos,
                            maxUsuarios: limits.maxUsuarios,
                            allowConsignaciones: limits.allowConsignaciones,
                            allowSucursales: limits.allowSucursales,
                        },
                    });
                }
            }

            // b) Branding (id=1)
            if (businessName && businessName.trim() !== "") {
                await tx.branding.upsert({
                    where: { id: 1 },
                    update: { businessName },
                    create: { id: 1, businessName },
                });
            } else {
                // opcional: garantizar que exista un branding base para evitar nulls en UI
                await tx.branding.upsert({
                    where: { id: 1 },
                    update: {},
                    create: { id: 1, businessName: "Mi Negocio" },
                });
            }

            // c) Configuracion (id=1)
            await tx.configuracion.upsert({
                where: { id: 1 },
                update: {},
                create: {
                    id: 1,
                    minStockGlobal: 5,
                    diasAnticipacionVencimiento: 7,
                    notificarVencimientos: true,
                    notificarStockBajo: true,
                    notificarVentas: true,
                    usarControlDeCaja: true,
                    diasAvisoConsignacion: 15,
                    notificarConsignacionesActivas: true,
                    notificarLiquidaciones: true,
                },
            });

            // d) Create Admin (unique email, but we’re safe because there are no users)
            const adminHash = await bcrypt.hash(admin.password, 10);
            const mainAdmin = await tx.usuario.create({
                data: {
                    nombre: admin.nombre,
                    email: admin.email,
                    hash: adminHash,
                    rol: RolUsuario.ADMIN,
                    activo: true,
                    // opcional: asignar sucursal principal
                    sucursalId: 1,
                },
            });

            // e) Subscription (verified)
            const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

            // OJO: externalId es unique -> garantizamos unicidad con timestamp
            const sub = await tx.subscription.create({
                data: {
                    userId: mainAdmin.id,
                    planId: finalPlanId,
                    provider: verificationProvider,
                    externalId: verificationExternalId,
                    status: verificationStatus,
                    trialEndsAt,
                },
            });

            // f) Caja Principal (depende de Sucursal 1)
            await tx.caja.upsert({
                where: { nombre: "Caja Principal" },
                update: {
                    activa: true,
                    sucursalId: 1,
                },
                create: {
                    nombre: "Caja Principal",
                    activa: true,
                    sucursalId: 1,
                },
            });

            // g) Staff
            if (staff && Array.isArray(staff) && staff.length > 0) {
                for (const member of staff) {
                    if (!member?.email || !member?.nombre) continue;

                    const passwordToUse =
                        member.password && member.password.trim() !== "" ? member.password : "123456";

                    const staffHash = await bcrypt.hash(passwordToUse, 10);

                    // Como estamos en "no users", no hay conflicto. Igual dejo create normal.
                    await tx.usuario.create({
                        data: {
                            nombre: member.nombre,
                            email: member.email,
                            hash: staffHash,
                            rol: RolUsuario.EMPLEADO,
                            activo: true,
                            sucursalId: 1,
                        },
                    });
                }
            }

            return { adminId: mainAdmin.id, subId: sub.id, user: mainAdmin };
        });

        const { signUserJwt, setAuthCookie } = await import("@/lib/auth");
        const token = await signUserJwt({
            sub: String(result.adminId),
            email: result.user.email,
            nombre: result.user.nombre,
            rol: result.user.rol,
            sucursalId: result.user.sucursalId,
        });
        await setAuthCookie(token);

        return NextResponse.json({ success: true, data: result }, { status: 201 });
    } catch (error: any) {
        console.error("Initialization error:", error);

        return NextResponse.json(
            {
                message: "Error interno durante la inicialización",
                prismaCode: error?.code,
                meta: error?.meta,
                error: error?.message,
            },
            { status: 500 }
        );
    }
}