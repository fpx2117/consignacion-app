
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

// Cargar .env manualmente si existe
if (fs.existsSync('.env')) {
    const env = fs.readFileSync('.env', 'utf8');
    env.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) process.env[key.trim()] = value.trim().replace(/^"|"$/g, '');
    });
}

const p = new PrismaClient();

async function check() {
    const sucursalId = 1;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pStats, vStats, pagosRecientes] = await Promise.all([
        p.pago.groupBy({
            by: ['tipo', 'sucursalId'],
            where: { fecha: { gte: startOfMonth } },
            _sum: { monto: true },
            _count: { _all: true }
        }),
        p.venta.groupBy({
            by: ['tipo', 'sucursalId'],
            where: { fecha: { gte: startOfMonth } },
            _sum: { total: true },
            _count: { _all: true }
        }),
        p.pago.findMany({
            where: { sucursalId, fecha: { gte: startOfMonth } },
            orderBy: { id: 'desc' },
            take: 10,
            include: { cliente: true }
        })
    ]);

    console.log('--- ESTADISTICAS PAGOS MES ACTUAL ---');
    pStats.forEach(s => {
        console.log(`Sucursal:${s.sucursalId} | Tipo:${s.tipo} | Cantidad:${s._count._all} | Suma:$${s._sum.monto}`);
    });

    console.log('\n--- ESTADISTICAS VENTAS MES ACTUAL ---');
    vStats.forEach(s => {
        console.log(`Sucursal:${s.sucursalId} | Tipo:${s.tipo} | Cantidad:${s._count._all} | Suma:$${s._sum.total}`);
    });

    console.log('\n--- ULTIMOS 10 PAGOS SUCURSAL 1 ---');
    pagosRecientes.forEach(pg => {
        console.log(`ID:#${pg.id} | Fecha:${pg.fecha.toLocaleDateString()} | Monto:$${pg.monto} | Tipo:${pg.tipo} | Cliente:${pg.cliente?.nombre}`);
    });
}

check().catch(console.error).finally(() => p.$disconnect());
