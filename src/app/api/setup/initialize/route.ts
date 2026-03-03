/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SUBSCRIPTION_PLANS, PLAN_LIMITS_DEFAULTS } from "@/constants/subscriptions";
import { EstadoSuscripcion, ProveedorSuscripcion, RolUsuario } from "@prisma/client";

// ✅ IMPORTANT: Prisma necesita Node runtime (NO Edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InitializeBody = {
    admin: { nombre: string; email: string; password: string };
    planId?: number;
    staff?: Array<{ nombre: string; email: string; password?: string }>;
    businessName?: string;
    promoCode?: string;
    paymentId?: string;
};

function jsonError(status: number, payload: any) {
    return NextResponse.json(payload, { status });
}

function requireEnv(name: string) {
    const v = process.env[name];
    if (!v || String(v).trim() === "") {
        throw new Error(`Missing required env var: ${name}`);
    }
    return v;
}

export async function POST(req: Request) {
    try {
        // ✅ Hard fail early if DB is not configured
        requireEnv("DATABASE_URL");

        // 1) Security check: only initialize if there are NO users
        const userCount = await prisma.usuario.count();
        if (userCount > 0) {
            return jsonError(403, { message: "El sistema ya ha sido inicializado" });
        }

        let body: InitializeBody;
        try {
            body = (await req.json()) as InitializeBody;
        } catch {
            return jsonError(400, { message: "Body inválido (JSON requerido)" });
        }

        const { admin, planId, staff, businessName, promoCode, paymentId } = body;

        if (!admin?.nombre || !admin?.email || !admin?.password) {
            return jsonError(400, { message: "Faltan datos del administrador" });
        }

        // --- VERIFICATION LOGIC (robusta) ---
        let verificationProvider: ProveedorSuscripcion;
        let verificationExternalId: string;
        const verificationStatus: EstadoSuscripcion = EstadoSuscripcion.ACTIVO;
        let trialDays = 30;
        let finalPlanId: number | null = typeof planId === "number" ? planId : null;

        // Validate planId when provided
        if (finalPlanId !== null && finalPlanId <= 0) {
            return jsonError(400, { message: "planId inválido" });
        }

        if (promoCode && String(promoCode).trim() !== "") {
            // Promo verification (read now; increment later in TX to keep atomic)
            const promo = await prisma.promoCode.findUnique({
                where: { code: promoCode.toUpperCase() },
                include: { plan: true },
            });

            if (!promo || !promo.activo || promo.usedCount >= promo.maxUses) {
                return jsonError(400, { message: "La licencia es inválida o ya fue utilizada" });
            }

            verificationProvider = ProveedorSuscripcion.PROMO;
            verificationExternalId = `PROMO-${promo.code}-${Date.now()}`;
            trialDays = promo.durationDays || 30;
            finalPlanId = promo.planId;
        } else if (paymentId && String(paymentId).trim() !== "") {
            const pid = String(paymentId).trim();
            const isPayPal = pid.startsWith("S-");

            if (isPayPal) {
                // PayPal verification
                try {
                    const { paymentConfig } = await import("@/lib/paymentConfig");
                    const { getPayPalAccessToken } = await import("@/lib/paypal");

                    const accessToken = await getPayPalAccessToken();
                    const base = paymentConfig?.paypal?.apiUrl;

                    if (!base) return jsonError(500, { message: "PayPal apiUrl no configurado" });

                    const response = await fetch(`${base}/v1/billing/subscriptions/${pid}`, {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            "Content-Type": "application/json",
                        },
                    });

                    if (!response.ok) {
                        return jsonError(400, { message: "No se pudo verificar la suscripción de PayPal" });
                    }

                    const subData = await response.json();
                    if (subData.status !== "ACTIVE") {
                        return jsonError(400, {
                            message: `La suscripción de PayPal no está activa (Estado: ${subData.status})`,
                        });
                    }

                    verificationProvider = ProveedorSuscripcion.PAYPAL;
                    verificationExternalId = pid;
                    trialDays = 30;
                } catch (err) {
                    console.error("PayPal verification error:", err);
                    return jsonError(400, { message: "Error verificando con PayPal" });
                }
            } else {
                // MercadoPago verification (Payment or PreApproval)
                try {
                    const { paymentConfig } = await import("@/lib/paymentConfig");
                    const mpAccessToken = paymentConfig?.mp?.accessToken;

                    if (!mpAccessToken) {
                        return jsonError(500, { message: "MercadoPago accessToken no configurado" });
                    }

                    const { MercadoPagoConfig, Payment } = await import("mercadopago");
                    const mpClient = new MercadoPagoConfig({ accessToken: mpAccessToken });

                    let verified = false;

                    // Try as single payment
                    try {
                        const payment = new Payment(mpClient);
                        const paymentData = await payment.get({ id: pid });

                        if (paymentData?.status === "approved") {
                            verificationProvider = ProveedorSuscripcion.MERCADOPAGO;
                            verificationExternalId = pid;
                            trialDays = 30;
                            verified = true;
                        }
                    } catch {
                        // ignore -> try preapproval
                    }

                    // Try as subscription (preapproval)
                    if (!verified) {
                        const { PreApproval } = await import("mercadopago");
                        const preApproval = new PreApproval(mpClient);
                        const subData = await preApproval.get({ id: pid });

                        if (subData?.status !== "authorized") {
                            return jsonError(400, {
                                message: `La suscripción de Mercado Pago no está autorizada (Estado: ${subData?.status})`,
                            });
                        }

                        verificationProvider = ProveedorSuscripcion.MERCADOPAGO;
                        verificationExternalId = pid;
                        trialDays = 30;
                        verified = true;
                    }

                    if (!verified) {
                        return jsonError(400, { message: "El pago o suscripción no está aprobado" });
                    }
                } catch (err) {
                    console.error("MercadoPago verification error:", err);
                    return jsonError(400, { message: "No se pudo verificar con Mercado Pago" });
                }
            }
        } else {
            return jsonError(402, {
                message: "Se requiere un pago o código promocional para activar el sistema",
            });
        }

        if (finalPlanId === null) {
            // fallback defensivo: si no vino planId y no vino promo con planId (no debería pasar)
            finalPlanId = 1;
        }

        // Exchange rate (NO rompe si falla)
        let exchangeRate = 1;
        try {
            const { fetchDolarBlue } = await import("@/lib/dolarBlue");
            const r = await fetchDolarBlue();
            exchangeRate = typeof r === "number" && !Number.isNaN(r) && r > 0 ? r : 1;
        } catch (e) {
            console.warn("fetchDolarBlue failed, fallback=1:", e);
            exchangeRate = 1;
        }

        // ✅ Transaction (todo lo que puede faltar -> upsert / create seguro)
        const result = await prisma.$transaction(async (tx) => {
            // 0) Ensure Sucursal 1 exists (evita FK defaults sucursalId=1)
            await tx.sucursal.upsert({
                where: { id: 1 },
                update: { activa: true },
                create: {
                    id: 1,
                    nombre: "Sucursal Principal",
                    esPrincipal: true,
                    activa: true,
                },
            });

            // 1) Sync plans and limits (upsert)
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

            // 2) Branding (id=1)
            await tx.branding.upsert({
                where: { id: 1 },
                update: businessName && businessName.trim() ? { businessName } : {},
                create: {
                    id: 1,
                    businessName: businessName && businessName.trim() ? businessName : "Mi Negocio",
                },
            });

            // 3) Configuracion (id=1)
            await tx.configuracion.upsert({
                where: { id: 1 },
                update: {},
                create: {
                    id: 1,
                    minStockGlobal: 5,
                    diasAnticipacionVencimiento: 7,
                    notificarStockBajo: true,
                    notificarVencimientos: true,
                    notificarVentas: true,
                    usarControlDeCaja: true,
                    diasAvisoConsignacion: 15,
                    notificarConsignacionesActivas: true,
                    notificarLiquidaciones: true,
                },
            });

            // 4) Caja Principal (depende de sucursal 1)
            await tx.caja.upsert({
                where: { nombre: "Caja Principal" },
                update: { activa: true, sucursalId: 1 },
                create: { nombre: "Caja Principal", activa: true, sucursalId: 1 },
            });

            // 5) Admin user
            const adminHash = await bcrypt.hash(admin.password, 10);
            const mainAdmin = await tx.usuario.create({
                data: {
                    nombre: admin.nombre,
                    email: admin.email,
                    hash: adminHash,
                    rol: RolUsuario.ADMIN,
                    activo: true,
                    sucursalId: 1,
                },
            });

            // 6) Subscription (externalId unique)
            const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

            const sub = await tx.subscription.create({
                data: {
                    userId: mainAdmin.id,
                    planId: finalPlanId!,
                    provider: verificationProvider!,
                    externalId: verificationExternalId!,
                    status: verificationStatus,
                    trialEndsAt,
                },
            });

            // 7) If promoCode was used -> increment within TX (atomic)
            if (promoCode && promoCode.trim()) {
                await tx.promoCode.update({
                    where: { code: promoCode.toUpperCase() },
                    data: { usedCount: { increment: 1 } },
                });
            }

            // 8) Staff
            if (Array.isArray(staff) && staff.length > 0) {
                for (const member of staff) {
                    if (!member?.email || !member?.nombre) continue;

                    const passwordToUse =
                        member.password && member.password.trim() !== "" ? member.password : "123456";

                    const staffHash = await bcrypt.hash(passwordToUse, 10);

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

        // 9) Login cookie
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
        console.error("Initialization error FULL:", error);

        return NextResponse.json(
            {
                message: "Error interno durante la inicialización",
                name: error?.name,
                prismaCode: error?.code,
                meta: error?.meta,
                error: error?.message,
                // stack solo en dev
                stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
            },
            { status: 500 }
        );
    }
}