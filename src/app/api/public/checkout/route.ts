import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MercadoPagoConfig, Preference } from "mercadopago";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { items, sucursalId } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "No hay items en el carrito" }, { status: 400 });
        }

        const sucursalIdNum = sucursalId ? Number(sucursalId) : 1;

        // Obtener configuración y credenciales de la sucursal
        const config = await prisma.configuracion.findUnique({
            where: { sucursalId: sucursalIdNum }
        });

        if (!config || !config.convertirTienda || !config.mpAccessTokenTienda) {
            return NextResponse.json({ error: "La tienda no está configurada o no acepta pagos" }, { status: 403 });
        }

        // Obtener los productos de la DB para validar precios y stock
        const productoIds = items.map((i: any) => i.id);
        const dbProductos = await prisma.producto.findMany({
            where: { id: { in: productoIds } }
        });

        const mpItems = items.map((item: any) => {
            const dbProd = dbProductos.find(p => p.id === item.id);
            if (!dbProd) throw new Error(`Producto ${item.id} no encontrado`);

            // Aplicar interés por tarjeta si existe
            const basePrice = Number(dbProd.precioVenta);
            const interestMultiplier = 1 + (config.porcentajeInteresTarjeta / 100);
            const finalPrice = basePrice * interestMultiplier;

            return {
                id: String(dbProd.id),
                title: dbProd.nombre,
                unit_price: Number(finalPrice.toFixed(2)),
                quantity: item.quantity,
                currency_id: "ARS"
            };
        });

        const client = new MercadoPagoConfig({
            accessToken: config.mpAccessTokenTienda,
            options: { timeout: 5000 }
        });

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        const preference = new Preference(client);
        const response = await preference.create({
            body: {
                items: mpItems,
                back_urls: {
                    success: `${baseUrl}/lista-de-precios?sucursalId=${sucursalIdNum}&status=success`,
                    failure: `${baseUrl}/lista-de-precios?sucursalId=${sucursalIdNum}&status=failure`,
                    pending: `${baseUrl}/lista-de-precios?sucursalId=${sucursalIdNum}&status=pending`,
                },
                auto_return: "approved",
                external_reference: JSON.stringify({ sucursalId: sucursalIdNum, type: "public_store" }),
            }
        });

        return NextResponse.json({ data: { init_point: response.init_point, preference_id: response.id } });
    } catch (error: any) {
        console.error("Error creating store preference:", error);
        return NextResponse.json({ error: error.message || "Error al procesar el pago" }, { status: 500 });
    }
}
