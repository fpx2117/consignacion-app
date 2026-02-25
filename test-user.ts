import { prisma } from './src/lib/prisma';
import bcrypt from 'bcryptjs';
import { EstadoSuscripcion, ProveedorSuscripcion, RolUsuario } from "@prisma/client";

async function main() {
    try {
        const exchangeRate = 1;
        let verificationProvider = ProveedorSuscripcion.PROMO;
        let verificationExternalId = "TEST-123";
        const verificationStatus = EstadoSuscripcion.ACTIVO;
        const finalPlanId = 1;
        const trialDays = 30;

        await prisma.$transaction(async (tx) => {
            // 5) Admin user
            const adminHash = await bcrypt.hash("123", 10);
            const mainAdmin = await tx.usuario.create({
                data: {
                    nombre: "Admin",
                    email: "admin2@test.com", // use different email just in case
                    hash: adminHash,
                    rol: RolUsuario.ADMIN,
                    activo: true,
                    sucursalId: 1,
                },
            });
            console.log("Admin OK");

            // 6) Subscription
            const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

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
            console.log("Sub OK");

        });
        console.log('Transaction SUCCESS');
    } catch (e) {
        console.error('ERROR IN MAIN:', e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
