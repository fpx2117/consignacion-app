const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const ventas = await prisma.venta.findMany({
        include: {
            cliente: true,
            sesionCaja: true,
            detalles: { include: { producto: { include: { categoria: true } } } }
        }
    });

    let modifiedCount = 0;

    for (const v of ventas) {
        let wasModified = false;
        let oldTotal = Number(v.total);
        let newTotal = 0;

        const catQty = new Map();
        for (const d of v.detalles) {
            if (d.producto.categoriaId) {
                catQty.set(d.producto.categoriaId, (catQty.get(d.producto.categoriaId) || 0) + d.units);
            }
        }

        const newDetallesData = [];

        for (const d of v.detalles) {
            let calcDesc = 0;
            const pu = Number(d.precioUnitario);
            if (d.producto.categoriaId) {
                const tq = catQty.get(d.producto.categoriaId);

                const rawDescuentos = d.producto.categoria?.descuentos;
                // En Prisma un campo Json a veces es retornado como tal, vamos a parsearlo
                let arr = [];
                if (Array.isArray(rawDescuentos)) {
                    arr = rawDescuentos;
                } else if (typeof rawDescuentos === "string") {
                    try { arr = JSON.parse(rawDescuentos); } catch (e) { }
                    if (!Array.isArray(arr)) arr = [];
                } else if (rawDescuentos && typeof rawDescuentos === "object") {
                    // Algunas veces Prisma envuelve el Json, dependerá si es Json o JsonB
                    // pero comprobaremos si es un array disfrazado:
                    if (Array.isArray(rawDescuentos)) arr = rawDescuentos;
                    else if (Array.isArray(rawDescuentos.data)) arr = rawDescuentos.data;
                    else arr = Object.values(rawDescuentos);
                }

                if (arr && arr.length > 0) {
                    const sorted = [...arr].sort((a, b) => b.cantidadMin - a.cantidadMin);
                    const best = sorted.find((desc) => tq >= desc.cantidadMin);
                    if (best) {
                        calcDesc = pu * d.units * (Number(best.porcentaje) / 100);
                    }
                }
            }

            const subtotal = Number((pu * d.units) - calcDesc);
            newTotal += subtotal;

            const currentDesc = Number(d.descuento);
            if (Math.abs(calcDesc - currentDesc) > 0.01) {
                wasModified = true;
                console.log(`Venta #${v.id} Detalle #${d.id} desc cambiará de ${currentDesc} a ${calcDesc}`);
            }

            newDetallesData.push({
                id: d.id,
                descuento: calcDesc,
                subtotal: subtotal
            });
        }

        if (wasModified) {
            console.log(`Update Venta #${v.id} total cambiará de ${oldTotal} a ${newTotal}`);
            await prisma.$transaction(async (tx) => {
                for (const nd of newDetallesData) {
                    await tx.ventaDetalle.update({
                        where: { id: nd.id },
                        data: { descuento: nd.descuento, subtotal: nd.subtotal }
                    });
                }
                await tx.venta.update({
                    where: { id: v.id },
                    data: { total: newTotal }
                });

                const pago = await tx.pago.findFirst({
                    where: {
                        clienteId: v.clienteId,
                        sesionCajaId: v.sesionCajaId || null,
                        // monto: oldTotal -> podria no coincidir exacto por decimales, mejor no filtrar por monto
                    }
                });

                if (pago) {
                    await tx.pago.update({
                        where: { id: pago.id },
                        data: { monto: newTotal }
                    });
                }
            });
            modifiedCount++;
        }
    }

    console.log('Finished fixing', modifiedCount, 'ventas');
}

main().catch(console.error).finally(() => prisma.$disconnect());
