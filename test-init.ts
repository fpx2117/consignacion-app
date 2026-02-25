import { prisma } from './src/lib/prisma';
import { SUBSCRIPTION_PLANS, PLAN_LIMITS_DEFAULTS } from './src/constants/subscriptions';

async function main() {
    try {
        const exchangeRate = 1;

        await prisma.$transaction(async (tx) => {
            // 0) Ensure Sucursal 1 exists
            await tx.sucursal.upsert({
                where: { id: 1 },
                update: { activa: true },
                create: {
                    id: 1,
                    nombre: 'Sucursal Principal',
                    esPrincipal: true,
                    activa: true,
                },
            });
            console.log('Sucursal OK');

            // 1) Sync plans and limits
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
            console.log('Plans OK');

            await tx.branding.upsert({
                where: { id: 1 },
                update: {},
                create: {
                    id: 1,
                    businessName: 'Mi Negocio',
                },
            });
            console.log('Branding OK');

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
            console.log('Config OK');

            // Caja depends on sucursal
            await tx.caja.upsert({
                where: { nombre: 'Caja Principal' },
                update: { activa: true, sucursalId: 1 },
                create: { nombre: 'Caja Principal', activa: true, sucursalId: 1 },
            });
            console.log('Caja OK');
        });
        console.log('Transaction SUCCESS');
    } catch (e) {
        console.error('ERROR IN MAIN:', e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
