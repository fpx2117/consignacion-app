
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
    const sucursalId = 1;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const pagos = await p.pago.findMany({
        where: { sucursalId, fecha: { gte: startOfMonth } },
        orderBy: { id: 'desc' },
        include: { cliente: true }
    });

    console.log(`--- MOST RECENT PAGOS (TOT: ${pagos.length}) ---`);
    pagos.slice(0, 20).forEach(pg => {
        console.log(`[P] ID:#${pg.id} | Fecha:${pg.fecha.toLocaleDateString()} | Monto:$${pg.monto} | Cliente:${pg.cliente?.nombre || 'N/A'} | Tipo:${pg.tipo}`);
    });

    const sum = pagos.reduce((acc, pg) => acc + Number(pg.monto), 0);
    console.log('SUMA PAGOS MES ACTUAL:', sum);
}

check().catch(console.error).finally(() => p.$disconnect());
