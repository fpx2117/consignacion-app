import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { paymentConfig } from "@/lib/paymentConfig";
import { sendNotification } from "@/lib/socket-trigger";
import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types";
import { seedPlanLimits } from "@/lib/requireSubscription";
import {
    MotivoMovimientoStock,
    Prisma,
    TipoMovimientoStock,
    TipoVenta,
} from "@prisma/client";

type MPWebhookPayload = {
    action?: string;
    data?: {
        id?: string | number;
    };
};

type MPPaymentStatus = "approved" | "rejected" | "cancelled" | "pending" | "in_process" | string;

type MPPaymentData = {
    id?: string | number;
    status?: MPPaymentStatus;
    status_detail?: string;
    external_reference?: string | null;
    order?: {
        id?: string | number;
    };
};

type CheckoutIntentClienteSnapshot = {
    nombre?: string;
    email?: string | null;
    documento?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    provincia?: string | null;
    localidad?: string | null;
    codigoPostal?: string | null;
    sucursalId?: number | string;
};

type CheckoutIntentItemSnapshot = {
    productoId?: number | string;
    quantity?: number | string;
    units?: number | string;
    precioUnitarioFinal?: number | string;
    precioUnitario?: number | string;
    subtotal?: number | string;
};

type CheckoutIntentEnvioSnapshot = {
    metodoEnvio?: string;
    costo?: number | string;
    direccion?: Prisma.InputJsonValue;
};

type CheckoutIntentTotalsSnapshot = {
    totalGeneral?: number | string;
};

type CheckoutIntentSelected = {
    id: string;
    cliente: Prisma.JsonValue;
    items: Prisma.JsonValue;
    envio: Prisma.JsonValue | null;
    totals: Prisma.JsonValue;
    status: string;
    mpPaymentId: string | null;
    processedAt: Date | null;
    ventaId: number | null;
};

type CheckoutIntentDbClient = {
    findUnique: (args: {
        where: { externalReference?: string; id?: string };
        select?: Record<string, boolean>;
    }) => Promise<CheckoutIntentSelected | null>;
    update: (args: {
        where: { id: string };
        data: Record<string, unknown>;
        select?: Record<string, boolean>;
    }) => Promise<{ id: string; ventaId?: number | null }>;
};

type PrismaWithCheckoutIntent = typeof prisma & {
    checkoutIntent: CheckoutIntentDbClient;
};

type TxWithCheckoutIntent = Prisma.TransactionClient & {
    checkoutIntent: CheckoutIntentDbClient;
};

type SubscriptionWithUser = {
    userId: number;
    planId: number;
    user: { nombre: string };
};

type NormalizedCheckoutItem = {
    productoId: number;
    units: number;
    precioUnitario: number;
    subtotal: number;
};

function toPlainObject(value: Prisma.JsonValue | null): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}

function toNumber(value: unknown, fallback = 0): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function toNonEmptyString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function isPaymentAction(action: string | undefined): boolean {
    return !!action && action.startsWith("payment.");
}

async function fetchMercadoPagoPayment(paymentId: string): Promise<MPPaymentData> {
    const accessToken = paymentConfig.mp.accessToken;
    if (!accessToken) {
        throw new Error("Mercado Pago accessToken no configurado para consultar pagos");
    }

    const { MercadoPagoConfig, Payment } = await import("mercadopago");
    const client = new MercadoPagoConfig({
        accessToken,
        options: { timeout: 5000 },
    });

    const payment = new Payment(client);
    return (await payment.get({ id: paymentId })) as MPPaymentData;
}

async function findOrCreateClienteFromIntent(
    tx: Prisma.TransactionClient,
    rawCliente: Prisma.JsonValue | null,
    sucursalId: number,
) {
    const clienteData = toPlainObject(rawCliente) as CheckoutIntentClienteSnapshot;
    const email = toNonEmptyString(clienteData.email);
    const nombre = toNonEmptyString(clienteData.nombre) ?? "Consumidor Final";

    let cliente = email
        ? await tx.cliente.findFirst({
            where: { email, sucursalId },
        })
        : null;

    const clientePayload = {
        nombre,
        email,
        documento: toNonEmptyString(clienteData.documento),
        telefono: toNonEmptyString(clienteData.telefono),
        direccion: toNonEmptyString(clienteData.direccion),
        provincia: toNonEmptyString(clienteData.provincia),
        localidad: toNonEmptyString(clienteData.localidad),
        codigoPostal: toNonEmptyString(clienteData.codigoPostal),
        sucursalId,
    };

    if (!cliente) {
        cliente = await tx.cliente.create({
            data: clientePayload,
        });
        return cliente;
    }

    cliente = await tx.cliente.update({
        where: { id: cliente.id },
        data: {
            nombre: clientePayload.nombre,
            documento: clientePayload.documento ?? cliente.documento,
            telefono: clientePayload.telefono ?? cliente.telefono,
            direccion: clientePayload.direccion ?? cliente.direccion,
            provincia: clientePayload.provincia ?? cliente.provincia,
            localidad: clientePayload.localidad ?? cliente.localidad,
            codigoPostal: clientePayload.codigoPostal ?? cliente.codigoPostal,
        },
    });

    return cliente;
}

async function processApprovedCheckoutPayment(externalReference: string, payment: MPPaymentData) {
    const paymentId = String(payment.id);

    return prisma.$transaction(async (tx) => {
        const txWithCheckoutIntent = tx as TxWithCheckoutIntent;

        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${externalReference}))`;

        const intent = await txWithCheckoutIntent.checkoutIntent.findUnique({
            where: { externalReference },
        });

        if (!intent) {
            return { type: "not_found" as const };
        }

        if (intent.status === "PAID" && intent.ventaId) {
            return { type: "already_paid" as const, ventaId: intent.ventaId };
        }

        if (intent.processedAt && intent.mpPaymentId) {
            return { type: "already_processed" as const, mpPaymentId: intent.mpPaymentId };
        }

        if (intent.mpPaymentId && intent.mpPaymentId !== paymentId) {
            return {
                type: "different_payment" as const,
                existingPaymentId: intent.mpPaymentId,
            };
        }

        const clienteSnapshot = toPlainObject(intent.cliente) as CheckoutIntentClienteSnapshot;
        const itemsRaw = Array.isArray(intent.items) ? intent.items : [];
        const totalsSnapshot = toPlainObject(intent.totals) as CheckoutIntentTotalsSnapshot;

        const sucursalId = toNumber(clienteSnapshot.sucursalId, 1);
        const normalizedItems: NormalizedCheckoutItem[] = itemsRaw.map((rawItem: Prisma.JsonValue) => {
            const item = toPlainObject(rawItem as Prisma.JsonValue) as CheckoutIntentItemSnapshot;
            const productoId = toNumber(item.productoId, NaN);
            const units = toNumber(item.quantity ?? item.units, NaN);
            const precioUnitario = toNumber(item.precioUnitarioFinal ?? item.precioUnitario, NaN);
            const subtotal = toNumber(item.subtotal, Number((precioUnitario * units).toFixed(2)));

            return {
                productoId,
                units,
                precioUnitario,
                subtotal,
            };
        });

        if (normalizedItems.length === 0) {
            throw new Error(`CheckoutIntent ${intent.id} sin items para procesar`);
        }

        for (const item of normalizedItems) {
            if (!Number.isInteger(item.productoId) || item.productoId <= 0) {
                throw new Error(`CheckoutIntent ${intent.id} tiene producto inválido`);
            }

            if (!Number.isInteger(item.units) || item.units <= 0) {
                throw new Error(`CheckoutIntent ${intent.id} tiene cantidad inválida`);
            }

            if (!Number.isFinite(item.precioUnitario) || item.precioUnitario < 0) {
                throw new Error(`CheckoutIntent ${intent.id} tiene precio inválido`);
            }
        }

        const cliente = await findOrCreateClienteFromIntent(tx, intent.cliente, sucursalId);

        for (const item of normalizedItems) {
            const stockSucursalInfo = await tx.stockSucursal.findUnique({
                where: { productoId_sucursalId: { productoId: item.productoId, sucursalId } },
                include: { producto: true },
            });

            if (!stockSucursalInfo) {
                throw new Error(`El producto #${item.productoId} no está asignado a la sucursal.`);
            }

            const affectedStockSucursal = await tx.stockSucursal.updateMany({
                where: {
                    productoId: item.productoId,
                    sucursalId,
                    stockDisponibleUnits: { gte: item.units },
                },
                data: { stockDisponibleUnits: { decrement: item.units } },
            });

            if (affectedStockSucursal.count === 0) {
                throw new Error(`Stock insuficiente para "${stockSucursalInfo.producto.nombre}".`);
            }

            const stockSucursalDespues = await tx.stockSucursal.findUnique({
                where: { productoId_sucursalId: { productoId: item.productoId, sucursalId } },
                select: { stockDisponibleUnits: true },
            });

            if (!stockSucursalDespues) {
                throw new Error(`No se pudo confirmar stock para el producto #${item.productoId}.`);
            }

            const affectedProducto = await tx.producto.updateMany({
                where: {
                    id: item.productoId,
                    stockDisponibleUnits: { gte: item.units },
                },
                data: { stockDisponibleUnits: { decrement: item.units } },
            });

            if (affectedProducto.count === 0) {
                throw new Error(`Inconsistencia de stock para "${stockSucursalInfo.producto.nombre}".`);
            }

            const stockPosterior = stockSucursalDespues.stockDisponibleUnits;
            const stockPrevio = stockPosterior + item.units;

            await tx.movimientoStock.create({
                data: {
                    productoId: item.productoId,
                    sucursalId,
                    tipo: TipoMovimientoStock.SALIDA,
                    motivo: MotivoMovimientoStock.VENTA,
                    cantidad: item.units,
                    stockPrevio,
                    stockPosterior,
                    observaciones: `Checkout público Mercado Pago (${externalReference})`,
                },
            });
        }

        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(1000000 + sucursalId)})`;

        const lastVenta = await tx.venta.findFirst({
            where: { sucursalId },
            orderBy: { numeroVenta: "desc" },
            select: { numeroVenta: true },
        });

        const nextNumeroVenta = (lastVenta?.numeroVenta || 0) + 1;
        const totalGeneral = toNumber(totalsSnapshot.totalGeneral, NaN);
        const totalVenta = Number.isFinite(totalGeneral)
            ? totalGeneral
            : Number(normalizedItems.reduce((acc: number, item: NormalizedCheckoutItem) => acc + item.subtotal, 0).toFixed(2));

        const envioSnapshot = toPlainObject(intent.envio) as CheckoutIntentEnvioSnapshot;
        const costoEnvio = toNumber(envioSnapshot.costo, 0);
        const metodoEnvio = toNonEmptyString(envioSnapshot.metodoEnvio);
        const shouldCreateEnvio = metodoEnvio !== null || costoEnvio > 0;

        const venta = await tx.venta.create({
            data: {
                tipo: TipoVenta.CASUAL,
                clienteId: cliente.id,
                sucursalId,
                numeroVenta: nextNumeroVenta,
                total: totalVenta,
                descuentoGlobal: 0,
                metodoPago: "TARJETA",
                detalles: {
                    create: normalizedItems.map((item: NormalizedCheckoutItem) => ({
                        productoId: item.productoId,
                        units: item.units,
                        precioUnitario: item.precioUnitario,
                        descuento: 0,
                        subtotal: item.subtotal,
                    })),
                },
                ...(shouldCreateEnvio
                    ? {
                        envio: {
                            create: {
                                costo: Number(costoEnvio.toFixed(2)),
                                metodoEnvio: metodoEnvio ?? "DOMICILIO",
                                direccionEnvio: (envioSnapshot.direccion as Prisma.InputJsonValue) ?? {},
                            },
                        },
                    }
                    : {}),
            },
        });

        await tx.pago.create({
            data: {
                clienteId: cliente.id,
                sucursalId,
                tipo: "VENTA",
                monto: totalVenta,
                metodo: "TARJETA",
            },
        });

        const updatedIntent = await txWithCheckoutIntent.checkoutIntent.update({
            where: { id: intent.id },
            data: {
                status: "PAID",
                processedAt: new Date(),
                ventaId: venta.id,
                mpPaymentId: paymentId,
                mpMerchantOrderId: payment.order?.id ? String(payment.order.id) : null,
                failureReason: null,
            },
            select: {
                id: true,
                ventaId: true,
            },
        });

        return {
            type: "created" as const,
            intentId: updatedIntent.id,
            ventaId: updatedIntent.ventaId ?? null,
        };
    }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
}

// Mercado Pago Webhook Validation
// Ref: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
function validateSignature(xSignature: string, xRequestId: string, dataId: string | undefined) {
    const secret = paymentConfig.mp.webhookSecret;
    if (!secret) {
        console.error("[MercadoPago] Missing webhook secret — cannot validate signature");
        return false;
    }

    // The signature format is "ts=...,v1=..."
    const parts = xSignature.split(",");
    const tsPart = parts.find((p) => p.trimStart().startsWith("ts="));
    const v1Part = parts.find((p) => p.trimStart().startsWith("v1="));

    if (!tsPart || !v1Part) return false;

    const ts = tsPart.split("=")[1];
    const v1 = v1Part.split("=")[1];

    // Build manifest per MP docs: id:[data.id];request-id:[x-request-id];ts:[ts];
    let manifest = "";
    if (dataId) manifest += `id:${dataId};`;
    manifest += `request-id:${xRequestId};ts:${ts};`;

    const signature = crypto
        .createHmac("sha256", secret)
        .update(manifest)
        .digest("hex");

    const safeV1 = v1?.trim().toLowerCase();
    const isHex = /^[0-9a-f]+$/i.test(safeV1);

    if (!safeV1 || !isHex || safeV1.length !== signature.length || safeV1.length % 2 !== 0) {
        return false;
    }

    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature, "hex"),
            Buffer.from(safeV1, "hex")
        );
    } catch {
        return false;
    }
}

export async function POST(request: Request) {
    const prismaWithCheckoutIntent = prisma as unknown as PrismaWithCheckoutIntent;
    const xSignature = request.headers.get("x-signature");
    const xRequestId = request.headers.get("x-request-id");
    const rawBody = await request.text();

    let data: MPWebhookPayload;
    try {
        data = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { action, data: eventData } = data;

    // 1. Signature Validation (Critical for Security)
    // data.id is included in the manifest per MercadoPago V2 webhook docs
    const dataId = eventData?.id ? String(eventData.id) : undefined;
    if (!xSignature || !xRequestId || !validateSignature(xSignature, xRequestId, dataId)) {
        console.warn("⚠️ Invalid Mercado Pago Webhook Signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    console.log(`[MercadoPago Webhook] Action: ${action}`, eventData);

    try {
        // 2. Handle Subscription Related Actions (PreApproval)
        if (action === "subscription_preapproval.created" || action === "subscription_preapproval.updated") {
            const externalId = eventData?.id ? String(eventData.id) : null;

            if (!externalId) {
                console.warn("[MercadoPago Webhook] Evento de suscripción sin externalId");
                return NextResponse.json({ received: true });
            }

            const subscription = await prisma.subscription.findUnique({
                where: { externalId },
                include: { user: true, plan: true }
            }) as SubscriptionWithUser | null;

            if (subscription) {
                // En un flujo real, consultaríamos a MP para ver el plan_id actual
                // Si el planId cambió (downgrade/upgrade), actualizamos
                // Por ahora, asumimos que si el webhook dispara, es para activar/extender

                await prisma.subscription.update({
                    where: { externalId },
                    data: {
                        status: "ACTIVO",
                        updatedAt: new Date(),
                        mpPreapprovalId: externalId
                    }
                });

                await sendNotification({
                    type: NOTIFICATION_TYPE.SUBSCRIPTION_ACTIVE,
                    title: "Suscripción Mercado Pago",
                    message: `La suscripción de ${subscription.user.nombre} está activa.`,
                    data: { userId: subscription.userId }
                });

                // Si es un downgrade, manejarlo
                // (Nota: En MP PreApproval el planId suele estar en el external_reference o metadata)
                // Por simplicidad en este MVP, si recibimos un cambio de plan, llamamos a:
                // await handlePlanDowngrade(newPlanId);

                await seedPlanLimits(subscription.planId);
            }
        }

        // 3. Handle Payment Related Actions (Checkout Público V2)
        if (isPaymentAction(action)) {
            const paymentId = eventData?.id ? String(eventData.id) : null;

            if (!paymentId) {
                console.warn("[MercadoPago Webhook] Evento de pago sin data.id");
                return NextResponse.json({ received: true });
            }

            const payment = await fetchMercadoPagoPayment(paymentId);
            const externalReference = toNonEmptyString(payment.external_reference);

            if (!externalReference) {
                console.info(`[MercadoPago Webhook] Pago ${paymentId} sin external_reference. Ignorado.`);
                return NextResponse.json({ received: true });
            }

            const checkoutIntent = await prismaWithCheckoutIntent.checkoutIntent.findUnique({
                where: { externalReference },
                select: {
                    id: true,
                    status: true,
                    ventaId: true,
                    mpPaymentId: true,
                    processedAt: true,
                },
            });

            if (!checkoutIntent) {
                console.info(
                    `[MercadoPago Webhook] external_reference ${externalReference} no corresponde a CheckoutIntent.`,
                );
                return NextResponse.json({ received: true });
            }

            if (checkoutIntent.status === "PAID" && checkoutIntent.ventaId) {
                console.info(
                    `[MercadoPago Webhook] CheckoutIntent ${checkoutIntent.id} ya está pago (venta ${checkoutIntent.ventaId}).`,
                );
                return NextResponse.json({ received: true });
            }

            if (checkoutIntent.processedAt && checkoutIntent.mpPaymentId) {
                console.info(
                    `[MercadoPago Webhook] CheckoutIntent ${checkoutIntent.id} ya fue procesado con pago ${checkoutIntent.mpPaymentId}.`,
                );
                return NextResponse.json({ received: true });
            }

            const paymentStatus = payment.status;
            if (paymentStatus === "approved") {
                const result = await processApprovedCheckoutPayment(externalReference, payment);

                if (result.type === "created") {
                    console.log(
                        `[MercadoPago Webhook] CheckoutIntent ${result.intentId} aprobado. Venta ${result.ventaId} creada.`,
                    );
                } else {
                    console.info(
                        `[MercadoPago Webhook] CheckoutIntent ${externalReference} procesado sin creación nueva (${result.type}).`,
                    );
                }

                return NextResponse.json({ received: true });
            }

            if (paymentStatus === "rejected" || paymentStatus === "cancelled") {
                const mappedStatus = paymentStatus === "cancelled" ? "CANCELLED" : "FAILED";

                await prismaWithCheckoutIntent.checkoutIntent.update({
                    where: { id: checkoutIntent.id },
                    data: {
                        status: mappedStatus,
                        mpPaymentId: paymentId,
                        processedAt: new Date(),
                        failureReason: payment.status_detail || `Pago ${paymentStatus}`,
                    },
                });

                console.info(
                    `[MercadoPago Webhook] CheckoutIntent ${checkoutIntent.id} marcado como ${mappedStatus}.`,
                );
                return NextResponse.json({ received: true });
            }

            console.info(
                `[MercadoPago Webhook] CheckoutIntent ${checkoutIntent.id} con estado de pago ${paymentStatus}. Esperando estado final.`,
            );
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[MercadoPago Webhook Error]:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
