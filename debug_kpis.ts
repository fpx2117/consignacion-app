
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function check() {
    const sucursalId = 1;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [ventas, pagos, liquidaciones] = await Promise.all([
        p.venta.findMany({ where: { sucursalId, fecha: { gte: startOfMonth } }, include: { liquidacion: true } }),
        p.pago.findMany({ where: { sucursalId, fecha: { gte: startOfMonth } } }),
        p.liquidacion.findMany({ where: { consignacion: { sucursalId }, fecha: { gte: startOfMonth } } })
    ]);

    console.log('--- RESUMEN MES ACTUAL ---');
    console.log('Ventas Totales (Count):', ventas.length);
    console.log('Ventas Totales (Sum):', ventas.reduce((acc, v) => acc + Number(v.total), 0));

    const ventasPorTipo = { CASUAL: 0, LIQUIDACION: 0 };
    ventas.forEach(v => { ventasPorTipo[v.tipo || 'CASUAL'] += Number(v.total); });
    console.log('Ventas por Tipo:', ventasPorTipo);

    console.log('--- PAGOS ---');
    console.log('Pagos Totales (Count):', pagos.length);
    console.log('Pagos Totales (Sum):', pagos.reduce((acc, pg) => acc + Number(pg.monto), 0));

    const pagosPorTipo = { VENTA: 0, DEUDA: 0 };
    pagos.forEach(pg => { pagosPorTipo[pg.tipo || 'VENTA'] += Number(pg.monto); });
    console.log('Pagos por Tipo:', pagosPorTipo);

    console.log('--- DETALLE VENTAS LIQUIDACION ---');
    const ventasLiq = ventas.filter(v => v.tipo === 'LIQUIDACION');
    ventasLiq.forEach(v => {
        console.log(`Venta #${v.id} - Total: ${v.total} - LiquidacionId: ${v.liquidacionId}`);
    });
}

check().catch(console.error).finally(() => p.$disconnect());
