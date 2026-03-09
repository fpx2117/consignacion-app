import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MercadoPagoConfig, Preference } from "mercadopago";
import crypto from "crypto";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { items, sucursalId, clienteData, envioData } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "No hay items en el carrito" }, { status: 400 });
        }

        // clienteData debe venir si se exige registro para el envío
        if (!clienteData || !clienteData.nombre || !clienteData.email) {
            return NextResponse.json({ error: "Datos de cliente incompletos" }, { status: 400 });
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

        // Sumar costo de envío (si lo hay) como un ítem de MP
        let costoEnvioFinal = 0;
        if (envioData && envioData.costo > 0) {
            costoEnvioFinal = Number(envioData.costo);
            mpItems.push({
                id: "ENVIO",
                title: `Envío a ${envioData.metodoEnvio === 'DOMICILIO' ? 'Domicilio' : 'Sucursal'}`,
                unit_price: costoEnvioFinal,
                quantity: 1,
                currency_id: "ARS"
            });
        }

        let cliente: any = await prisma.cliente.findFirst({
            where: { email: clienteData.email, sucursalId: sucursalIdNum }
        });

        if (!cliente) {
            cliente = await prisma.cliente.create({
                data: {
                    nombre: clienteData.nombre,
                    email: clienteData.email,
                    documento: clienteData.documento || null,
                    telefono: clienteData.telefono || null,
                    direccion: clienteData.direccion || null,
                    provincia: clienteData.provincia || null,
                    localidad: clienteData.localidad || null,
                    codigoPostal: clienteData.codigoPostal || null,
                    sucursalId: sucursalIdNum
                }
            });
        } else {
            // Actualizar dirección si la mandaron
            cliente = await prisma.cliente.update({
                where: { id: cliente.id },
                data: {
                    documento: clienteData.documento || cliente.documento,
                    telefono: clienteData.telefono || cliente.telefono,
                    direccion: clienteData.direccion || cliente.direccion,
                    provincia: clienteData.provincia || cliente.provincia,
                    localidad: clienteData.localidad || cliente.localidad,
                    codigoPostal: clienteData.codigoPostal || cliente.codigoPostal,
                }
            });
        }

        // 2. Crear Venta Pendiente
        let totalGeneral = items.reduce((acc: number, item: any) => {
            const dbProd = dbProductos.find(p => p.id === item.id);
            const basePrice = dbProd ? Number(dbProd.precioVenta) : 0;
            const interestMultiplier = 1 + (config.porcentajeInteresTarjeta / 100);
            return acc + (basePrice * interestMultiplier) * item.quantity;
        }, 0);
        totalGeneral += costoEnvioFinal;

        const venta = await prisma.venta.create({
            data: {
                clienteId: cliente.id,
                total: totalGeneral,
                tipo: "CASUAL",
                metodoPago: "TARJETA", // Viene de MP
                sucursalId: sucursalIdNum,
                detalles: {
                    create: items.map((item: any) => {
                        const dbProd = dbProductos.find(p => p.id === item.id);
                        const basePrice = dbProd ? Number(dbProd.precioVenta) : 0;
                        const finalPrice = basePrice * (1 + (config.porcentajeInteresTarjeta / 100));
                        return {
                            productoId: dbProd!.id,
                            units: item.quantity,
                            precioUnitario: finalPrice,
                            subtotal: finalPrice * item.quantity
                        };
                    })
                }
            }
        });

        // 3. Crear Envio
        if (envioData) {
            await prisma.envio.create({
                data: {
                    ventaId: venta.id,
                    estado: "PENDIENTE",
                    costo: costoEnvioFinal,
                    metodoEnvio: envioData.metodoEnvio || "DOMICILIO",
                    direccionEnvio: {
                        calle: clienteData.direccion,
                        cp: clienteData.codigoPostal,
                        provincia: clienteData.provincia,
                        localidad: clienteData.localidad
                    }
                }
            });
        }

        const client = new MercadoPagoConfig({
            accessToken: config.mpAccessTokenTienda,
            options: { timeout: 5000 }
        });

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        const preference = new Preference(client);
        const response = await preference.create({
            body: {
                items: mpItems,
                payer: {
                    email: cliente.email || undefined,
                    name: cliente.nombre,
                },
                back_urls: {
                    success: `${baseUrl}/lista-de-precios?sucursalId=${sucursalIdNum}&status=success`,
                    failure: `${baseUrl}/lista-de-precios?sucursalId=${sucursalIdNum}&status=failure`,
                    pending: `${baseUrl}/lista-de-precios?sucursalId=${sucursalIdNum}&status=pending`,
                },
                auto_return: "approved",
                external_reference: JSON.stringify({ ventaId: venta.id, type: "public_store_venta" }),
            },
            requestOptions: {
                idempotencyKey: crypto.randomUUID()
            }
        });

        return NextResponse.json({ data: { init_point: response.init_point, preference_id: response.id } });
    } catch (error: any) {
        console.error("Error creating store preference:", error);
        return NextResponse.json({ error: "Error al procesar el pago" }, { status: 500 });
    }
}
