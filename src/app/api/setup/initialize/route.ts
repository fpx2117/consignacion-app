import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SUBSCRIPTION_PLANS, PLAN_LIMITS_DEFAULTS } from "@/constants/subscriptions";
import { RolUsuario, ProveedorSuscripcion, EstadoSuscripcion } from "@prisma/client";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { paymentConfig } from "@/lib/paymentConfig";

const mpClient = new MercadoPagoConfig({
    accessToken: paymentConfig.mp.accessToken
});

export async function POST(req: Request) {
    try {
        // 1. Security check: Only initialize if there are NO users
        const userCount = await prisma.usuario.count();
        if (userCount > 0) {
            return NextResponse.json(
                { message: "El sistema ya ha sido inicializado" },
                { status: 403 }
            );
        }

        const { admin, planId, staff, businessName, promoCode, paymentId } = await req.json();

        if (!admin.nombre || !admin.email || !admin.password) {
            return NextResponse.json(
                { message: "Faltan datos del administrador" },
                { status: 400 }
            );
        }

        // --- VERIFICATION LOGIC ---
        let verificationProvider: ProveedorSuscripcion = ProveedorSuscripcion.PROMO;
        let verificationExternalId = `SETUP-UNVERIFIED-${Date.now()}`;
        let verificationStatus = EstadoSuscripcion.ACTIVO;
        let trialDays = 30;

        if (promoCode) {
            const promo = await (prisma as any).promoCode.findUnique({
                where: { code: promoCode.toUpperCase() },
                include: { plan: true }
            });

            if (!promo || !promo.activo || promo.usedCount >= promo.maxUses) {
                return NextResponse.json({ message: "Código promocional inválido o agotado" }, { status: 400 });
            }

            verificationProvider = ProveedorSuscripcion.PROMO;
            verificationExternalId = `PROMO-${promoCode}-${Date.now()}`;
            trialDays = promo.durationDays || 30;

            // Increment promo use
            await (prisma as any).promoCode.update({
                where: { id: promo.id },
                data: { usedCount: { increment: 1 } }
            });
        } else if (paymentId) {
            try {
                // Verify with Mercado Pago
                const payment = new Payment(mpClient);
                const paymentData = await payment.get({ id: paymentId });

                if (paymentData.status !== "approved") {
                    return NextResponse.json({ message: "El pago no está aprobado" }, { status: 400 });
                }

                verificationProvider = ProveedorSuscripcion.MERCADOPAGO;
                verificationExternalId = String(paymentId);
                trialDays = 30; // Paid plans still get a formal start date
            } catch (err) {
                console.error("MP Verification Error:", err);
                return NextResponse.json({ message: "No se pudo verificar el pago con Mercado Pago" }, { status: 400 });
            }
        } else {
            // No promo, no payment -> NO ENTRY
            return NextResponse.json({ message: "Se requiere un pago o código promocional para activar el sistema" }, { status: 402 });
        }
        // --- END VERIFICATION ---

        // 2. Start Transaction
        const result = await prisma.$transaction(async (tx) => {
            // a. Sync Plans and Limits
            for (const p of SUBSCRIPTION_PLANS) {
                await tx.plan.upsert({
                    where: { id: p.id },
                    update: {
                        nombre: p.nombre,
                        descripcion: p.descripcion,
                        precioARS: p.precioARS,
                        precioUSD: p.precioUSD,
                        mercadopagoId: p.mercadopagoId,
                        paypalId: p.paypalId,
                    },
                    create: {
                        id: p.id,
                        nombre: p.nombre,
                        descripcion: p.descripcion,
                        precioARS: p.precioARS,
                        precioUSD: p.precioUSD,
                        mercadopagoId: p.mercadopagoId,
                        paypalId: p.paypalId,
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

            // b. Create Branding
            if (businessName) {
                await tx.branding.upsert({
                    where: { id: 1 },
                    update: { businessName },
                    create: { id: 1, businessName },
                });
            }

            // c. Create Admin User
            const adminHash = await bcrypt.hash(admin.password, 10);
            const mainAdmin = await tx.usuario.create({
                data: {
                    nombre: admin.nombre,
                    email: admin.email,
                    hash: adminHash,
                    rol: RolUsuario.ADMIN,
                    activo: true,
                },
            });

            // d. Create Subscription for Admin (Verified)
            const sub = await tx.subscription.create({
                data: {
                    userId: mainAdmin.id,
                    planId: planId,
                    provider: verificationProvider,
                    externalId: verificationExternalId,
                    status: verificationStatus,
                    trialEndsAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
                },
            });

            // e. Create Default Configuration
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
                },
            });

            // f. Create Default Caja
            await tx.caja.upsert({
                where: { nombre: "Caja Principal" },
                update: {},
                create: {
                    nombre: "Caja Principal",
                    activa: true,
                },
            });

            // g. Create Initial Staff
            if (staff && Array.isArray(staff) && staff.length > 0) {
                for (const member of staff) {
                    if (member.email && member.nombre) {
                        const staffHash = await bcrypt.hash("123456", 10);
                        await tx.usuario.create({
                            data: {
                                nombre: member.nombre,
                                email: member.email,
                                hash: staffHash,
                                rol: RolUsuario.EMPLEADO,
                                activo: true,
                            },
                        });
                    }
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
        });
        await setAuthCookie(token);

        return NextResponse.json({
            success: true,
            data: result
        }, { status: 201 });

    } catch (error: any) {
        console.error("Initialization error:", error);
        return NextResponse.json(
            { message: "Error interno durante la inicialización", error: error.message },
            { status: 500 }
        );
    }
}
