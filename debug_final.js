
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:8231MNGNYHJQ@yamabiko.proxy.rlwy.net:55320/railway"
        }
    }
});

async function check() {
    const sucursalId = 1;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pagos, ventas] = await Promise.all([
        p.pago.findMany({
            where: { sucursalId, fecha: { gte: startOfMonth } },
            orderBy: { monto: 'desc' },
            include: { venta: true, cliente: true }
        }),
        p.venta.findMany({
            where: { sucursalId, fecha: { gte: startOfMonth } }
        })
    ]);

    console.log(`--- PAGOS (MSG: ${pagos.length}) ---`);
    pagos.forEach(pg => {
        console.log(`ID:#${pg.id} | Monto:$${pg.monto} | Tipo:${pg.tipo} | VentaId:${pg.ventaId || 'MANUAL'} | Cliente:${pg.cliente?.nombre}`);
    });

    console.log(`\n--- SUMAS ---`);
    console.log('Total Pagos:', pagos.reduce((acc, p) => acc + Number(p.monto), 0));
    console.log('Total Ventas:', ventas.reduce((acc, v) => acc + Number(v.total), 0));
}

check().catch(console.error).finally(() => p.$disconnect());
