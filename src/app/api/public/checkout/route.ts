import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MercadoPagoConfig, Preference } from "mercadopago";
import crypto from "crypto";

type CheckoutItemInput = {
    id: number | string;
    quantity: number | string;
};

type ClienteDataInput = {
    nombre: string;
    email: string;
    documento?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    provincia?: string | null;
    localidad?: string | null;
    codigoPostal?: string | null;
};

type EnvioDataInput = {
    costo?: number | string;
    metodoEnvio?: string;
};

type CheckoutBody = {
    items: CheckoutItemInput[];
    sucursalId?: number | string;
    clienteData: ClienteDataInput;
    envioData?: EnvioDataInput | null;
};

type CheckoutIntentClient = {
    create: (args: {
        data: {
            cliente: Record<string, unknown>;
            items: unknown[];
            envio: Record<string, unknown> | null;
            totals: Record<string, unknown>;
            status: "INITIATED";
            externalReference: string;
        };
    }) => Promise<{ id: string; externalReference: string }>;
    update: (args: {
        where: { id: string };
        data: {
            mpPreferenceId?: string | null;
            status?: "FAILED";
            failureReason?: string;
        };
    }) => Promise<unknown>;
};

export async function POST(req: Request) {
    let checkoutIntentId: string | null = null;

    try {
        const body = (await req.json()) as CheckoutBody;
        const { items, sucursalId, clienteData, envioData } = body;
        const checkoutIntentDb = (prisma as unknown as { checkoutIntent: CheckoutIntentClient }).checkoutIntent;

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
        const productoIds = items.map((i) => Number(i.id));
        const dbProductos = await prisma.producto.findMany({
            where: { id: { in: productoIds } }
        });

        const productoPorId = new Map(dbProductos.map((producto) => [producto.id, producto]));
        const porcentajeInteres = Number(config.porcentajeInteresTarjeta || 0);
        const interestMultiplier = 1 + (porcentajeInteres / 100);

        const normalizedItems = items.map((item) => {
            const dbProd = productoPorId.get(Number(item.id));
            if (!dbProd) {
                throw new Error(`Producto ${item.id} no encontrado`);
            }

            const quantity = Number(item.quantity);
            if (!Number.isFinite(quantity) || quantity <= 0) {
                throw new Error(`Cantidad inválida para el producto ${item.id}`);
            }

            const basePrice = Number(dbProd.precioVenta);
            const unitPrice = Number((basePrice * interestMultiplier).toFixed(2));
            const subtotal = Number((unitPrice * quantity).toFixed(2));

            return {
                productoId: dbProd.id,
                nombre: dbProd.nombre,
                quantity,
                precioBase: Number(basePrice.toFixed(2)),
                precioUnitarioFinal: unitPrice,
                subtotal,
            };
        });

        const mpItems = normalizedItems.map((item) => ({
            id: String(item.productoId),
            title: item.nombre,
            unit_price: item.precioUnitarioFinal,
            quantity: item.quantity,
            currency_id: "ARS",
        }));

        // Sumar costo de envío (si lo hay) como un ítem de MP
        let costoEnvioFinal = 0;
        const envioCostoRaw = Number(envioData?.costo ?? 0);
        if (envioData && envioCostoRaw > 0) {
            costoEnvioFinal = envioCostoRaw;
            mpItems.push({
                id: "ENVIO",
                title: `Envío a ${envioData.metodoEnvio === 'DOMICILIO' ? 'Domicilio' : 'Sucursal'}`,
                unit_price: costoEnvioFinal,
                quantity: 1,
                currency_id: "ARS"
            });
        }

        let cliente = await prisma.cliente.findFirst({
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

        // 2. Crear intención de checkout
        const subtotalItems = normalizedItems.reduce((acc, item) => acc + item.subtotal, 0);
        const totalGeneral = Number((subtotalItems + costoEnvioFinal).toFixed(2));

        const checkoutToken = `chk_${crypto.randomUUID().replace(/-/g, "")}`;
        const checkoutIntent = await checkoutIntentDb.create({
            data: {
                cliente: {
                    nombre: cliente.nombre,
                    email: cliente.email,
                    documento: cliente.documento,
                    telefono: cliente.telefono,
                    direccion: cliente.direccion,
                    provincia: cliente.provincia,
                    localidad: cliente.localidad,
                    codigoPostal: cliente.codigoPostal,
                    sucursalId: sucursalIdNum,
                },
                items: normalizedItems,
                envio: envioData
                    ? {
                        metodoEnvio: envioData.metodoEnvio || "DOMICILIO",
                        costo: costoEnvioFinal,
                        direccion: {
                            calle: clienteData.direccion || null,
                            cp: clienteData.codigoPostal || null,
                            provincia: clienteData.provincia || null,
                            localidad: clienteData.localidad || null,
                        },
                    }
                    : null,
                totals: {
                    subtotalItems: Number(subtotalItems.toFixed(2)),
                    costoEnvio: Number(costoEnvioFinal.toFixed(2)),
                    totalGeneral,
                    porcentajeInteresTarjeta: porcentajeInteres,
                },
                status: "INITIATED",
                externalReference: checkoutToken,
            },
        });
        checkoutIntentId = checkoutIntent.id;

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
                    success: `${baseUrl}/lista?sucursalId=${sucursalIdNum}&status=success`,
                    failure: `${baseUrl}/lista?sucursalId=${sucursalIdNum}&status=failure`,
                    pending: `${baseUrl}/lista?sucursalId=${sucursalIdNum}&status=pending`,
                },
                auto_return: "approved",
                external_reference: checkoutIntent.externalReference,
            },
            requestOptions: {
                idempotencyKey: crypto.randomUUID()
            }
        });

        const preferenceId = response.id ? String(response.id) : null;

        await checkoutIntentDb.update({
            where: { id: checkoutIntent.id },
            data: { mpPreferenceId: preferenceId },
        });

        const payload = {
            init_point: response.init_point,
            preference_id: preferenceId,
            checkout_token: checkoutIntent.externalReference,
        };

        return NextResponse.json({ ...payload, data: payload });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error al crear la preferencia";

        if (checkoutIntentId) {
            const checkoutIntentDb = (prisma as unknown as { checkoutIntent: CheckoutIntentClient }).checkoutIntent;
            await checkoutIntentDb.update({
                where: { id: checkoutIntentId },
                data: {
                    status: "FAILED",
                    failureReason: errorMessage,
                },
            }).catch(() => null);
        }

        if (errorMessage.includes("Producto") || errorMessage.includes("Cantidad inválida")) {
            return NextResponse.json({ error: errorMessage }, { status: 400 });
        }

        console.error("Error creating store preference:", error);
        return NextResponse.json({ error: "Error al procesar el pago" }, { status: 500 });
    }
}
