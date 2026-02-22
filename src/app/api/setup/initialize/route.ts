import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SUBSCRIPTION_PLANS, PLAN_LIMITS_DEFAULTS } from "@/constants/subscriptions";
import { RolUsuario, ProveedorSuscripcion, EstadoSuscripcion } from "@prisma/client";

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

        const { admin, planId, staff } = await req.json();

        if (!admin.nombre || !admin.email || !admin.password) {
            return NextResponse.json(
                { message: "Faltan datos del administrador" },
                { status: 400 }
            );
        }

        // 2. Start Transaction
        const result = await prisma.$transaction(async (tx) => {
            // a. Sync Plans and Limits (ensure they exist in DB)
            for (const p of SUBSCRIPTION_PLANS) {
                const dbPlan = await tx.plan.upsert({
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

                // Sync limits for each plan
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

            // b. Create Admin User
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

            // c. Create Subscription for Admin
            const sub = await tx.subscription.create({
                data: {
                    userId: mainAdmin.id,
                    planId: planId,
                    provider: ProveedorSuscripcion.PROMO, // Setup initialization defaults to PROMO/Trial
                    externalId: `SETUP-${Date.now()}-${mainAdmin.id}`,
                    status: EstadoSuscripcion.ACTIVO,
                    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
                },
            });

            // e. Create Default Configuration (ID 1)
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

            // g. Create Initial Staff (if any)
            if (staff && Array.isArray(staff) && staff.length > 0) {
                for (const member of staff) {
                    if (member.email && member.nombre) {
                        const staffHash = await bcrypt.hash("123456", 10); // Default password for initial staff
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

            return { adminId: mainAdmin.id, subId: sub.id };
        });

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
