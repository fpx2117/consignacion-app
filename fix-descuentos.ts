import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getBestDiscount(descuentos: any, qty: number): any {
    if (!descuentos || !Array.isArray(descuentos) || descuentos.length === 0) return null;
    const sorted = [...descuentos].sort((a, b) => b.cantidadMin - a.cantidadMin);
    return sorted.find((d) => qty >= d.cantidadMin) ?? null;
}

async function fix() {
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
        const oldTotal = Number(v.total);
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
                const best = getBestDiscount(d.producto.categoria?.descuentos, tq);
                if (best) {
                    calcDesc = pu * d.units * (best.porcentaje / 100);
                }
            }

            const subtotal = (pu * d.units) - calcDesc;
            newTotal += subtotal;

            // if previously stored discount was 0 but should be >0
            if (Math.abs(calcDesc - Number(d.descuento)) > 0.01) {
                wasModified = true;
            }

            newDetallesData.push({
                id: d.id,
                descuento: calcDesc,
                subtotal: subtotal
            });
        }

        if (wasModified) {
            console.log(`Fixing Venta #${v.id}, total from ${oldTotal} to ${newTotal}`);
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
                        sesionCajaId: v.sesionCajaId,
                        monto: oldTotal
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

    console.log(`Corregidas ${modifiedCount} ventas exitosamente.`);
}

fix().catch(console.error).finally(() => prisma.$disconnect());
