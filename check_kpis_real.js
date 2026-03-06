
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
    const sucursalId = 1;
    const now = new Date();
    // Forzamos el inicio de mes de Marzo 2026 (según el contexto del sistema)
    // O simplemente usamos el inicio de mes real actual.
    // En el dashboard se ve "Este mes", y hoy es 6 de Marzo.
    const startOfMonth = new Date(2026, 2, 1); // Marzo is month 2 in JS

    console.log('--- DIAGNOSTICO KPI ---');
    console.log('Rango: >=', startOfMonth.toISOString());

    const [ventas, pagos] = await Promise.all([
        p.venta.findMany({
            where: { sucursalId, fecha: { gte: startOfMonth } },
            select: { id: true, total: true, tipo: true, fecha: true }
        }),
        p.pago.findMany({
            where: { sucursalId, fecha: { gte: startOfMonth } },
            select: { id: true, monto: true, tipo: true, fecha: true }
        })
    ]);

    const sumVentas = ventas.reduce((acc, v) => acc + Number(v.total), 0);
    const sumPagos = pagos.reduce((acc, p) => acc + Number(p.monto), 0);

    console.log('VENTAS TOTAL (MES):', sumVentas);
    console.log('PAGOS TOTAL (MES):', sumPagos);
    console.log('DIFERENCIA (Pagos - Ventas):', sumPagos - sumVentas);

    const vTipos = {};
    ventas.forEach(v => { vTipos[v.tipo] = (vTipos[v.tipo] || 0) + Number(v.total); });
    console.log('\nVENTAS POR TIPO:', vTipos);

    const pTipos = {};
    pagos.forEach(pg => { pTipos[pg.tipo] = (pTipos[pg.tipo] || 0) + Number(pg.monto); });
    console.log('PAGOS POR TIPO:', pTipos);

    // Buscar si hay pagos muy grandes que sumen los 80k
    const bigPagos = pagos.filter(pg => Number(pg.monto) >= 10000);
    if (bigPagos.length > 0) {
        console.log('\nPAGOS GRANDES (>= 10000):');
        bigPagos.forEach(pg => {
            console.log(`ID:#${pg.id} | Fecha:${pg.fecha.toISOString()} | Monto:${pg.monto} | Tipo:${pg.tipo}`);
        });
    }
}

check().catch(console.error).finally(() => p.$disconnect());
