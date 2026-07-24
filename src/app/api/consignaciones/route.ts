import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { createConsignacionSchema } from "@/lib/validators/consignacion";
import {
  EstadoConsignacion,
  MotivoMovimientoStock,
  Prisma,
  TipoMovimientoStock,
} from "@prisma/client";
import { checkFeature } from "@/lib/subscriptions/require-subscription";
import {
  buildSucursalWhere,
  isGlobalSucursalView,
} from "@/lib/security/sucursalScope";

// âœ… Imports Centralizados de Config y Notificaciones
import { obtenerConfiguracionGlobal } from "@/lib/config";
import {
  evaluateStockAlert,
  processNotificationQueue,
} from "@/lib/notificaciones/stock-alerts";

type NotificationQueueItem = NonNullable<ReturnType<typeof evaluateStockAlert>>;
type StockSucursalWithProducto = Prisma.StockSucursalGetPayload<{
  include: { producto: true };
}>;

const consignacionInclude = Prisma.validator<Prisma.ConsignacionInclude>()({
  cliente: true,
  detalles: { include: { producto: true } },
  _count: { select: { detalles: true } },
});

function parseEstadoConsignacion(value: string): EstadoConsignacion | null {
  if (
    value === EstadoConsignacion.ABIERTA ||
    value === EstadoConsignacion.CERRADA
  ) {
    return value;
  }

  return null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

// GET: Listar consignaciones
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  const sucursalWhere = buildSucursalWhere(auth);

  const { searchParams } = new URL(req.url);
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  const search = searchParams.get("search")?.trim() || "";
  const estado = searchParams.get("estado")?.trim() || "";

  // Si no se pasan page/limit → devuelve todos (backward compatibility)
  const isPaginated = pageParam !== null || limitParam !== null;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(limitParam || "20", 10) || 20),
  );
  const skip = (page - 1) * limit;

  // Construcción del where con filtros
  const where: Prisma.ConsignacionWhereInput = { ...sucursalWhere };
  if (estado) {
    const estadoNormalizado = parseEstadoConsignacion(estado.toUpperCase());
    if (!estadoNormalizado) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    where.estado = estadoNormalizado;
  }
  if (search) {
    where.OR = [
      { cliente: { nombre: { contains: search, mode: "insensitive" } } },
      // Búsqueda por número de folio si el término es numérico
      ...(Number.isFinite(Number(search)) && search !== ""
        ? [{ numeroFolio: { equals: Number(search) } }]
        : []),
    ];
  }

  if (!isPaginated) {
    // Sin paginación → comportamiento original
    const consignaciones = await prisma.consignacion.findMany({
      where,
      orderBy: { id: "desc" },
      include: consignacionInclude,
    });
    return NextResponse.json(
      { data: consignaciones },
      {
        headers: {
          "Cache-Control": "private, max-age=20, stale-while-revalidate=60",
        },
      },
    );
  }

  // Con paginación → count + findMany en paralelo
  const [total, consignaciones] = await Promise.all([
    prisma.consignacion.count({ where }),
    prisma.consignacion.findMany({
      where,
      orderBy: { id: "desc" },
      skip,
      take: limit,
      include: consignacionInclude,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return NextResponse.json(
    {
      data: consignaciones,
      total,
      page,
      limit,
      totalPages,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=20, stale-while-revalidate=60",
      },
    },
  );
}

// POST: Crear ConsignaciÃ³n
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json(
      {
        error:
          "Vista global en modo solo lectura. Selecciona una sucursal para crear consignaciones.",
      },
      { status: 409 },
    );
  }

  // Guard: Verificar que el plan permite consignaciones
  const featureCheck = await checkFeature("consignaciones");
  if (!featureCheck.allowed) {
    return NextResponse.json(
      { error: featureCheck.message, limitReached: true },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createConsignacionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "ValidaciÃ³n fallida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // âœ… 1. Preparar ConfiguraciÃ³n y Cola de Notificaciones
  const configGlobal = await obtenerConfiguracionGlobal(auth.activeSucursalId);
  const notificationsQueue: NotificationQueueItem[] = [];

  const porcentaje = configGlobal.porcentajeAumentoConsignacion || 0;
  const factorAumento = 1 + porcentaje / 100;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validar existencia del cliente
      const cliente = await tx.cliente.findUnique({
        where: { id: parsed.data.clienteId },
      });
      if (!cliente) throw new Error("CLIENTE_NO_EXISTE");

      // 2. LÃ³gica de Foliado
      const ultimaConsignacion = await tx.consignacion.findFirst({
        where: { clienteId: parsed.data.clienteId },
        orderBy: { numeroFolio: "desc" },
        select: { numeroFolio: true },
      });

      const nuevoFolio = ultimaConsignacion
        ? ultimaConsignacion.numeroFolio + 1
        : 1;

      // 3. Validar productos y stock en la sucursal activa
      const sucursalId = auth.activeSucursalId;
      const productIds = parsed.data.items.map((i) => i.productoId);

      const stocksSucursal = await tx.stockSucursal.findMany({
        where: {
          productoId: { in: productIds },
          sucursalId,
        },
        include: { producto: true },
      });

      const mapStock = new Map<number, StockSucursalWithProducto>(
        stocksSucursal.map((stock) => [stock.productoId, stock]),
      );

      for (const it of parsed.data.items) {
        const s = mapStock.get(it.productoId);
        if (!s) {
          throw new Error(`PRODUCTO_NO_ASIGNADO_SUCURSAL:${it.productoId}`);
        }
        if (s.stockDisponibleUnits < it.unitsEntregadas) {
          throw new Error(`STOCK_INSUF:${it.productoId}`);
        }
      }

      // 4. Crear consignaciÃ³n
      const consignacion = await tx.consignacion.create({
        data: {
          clienteId: parsed.data.clienteId,
          sucursalId,
          numeroFolio: nuevoFolio,
          estado: "ABIERTA",
          porcentajeAumento: porcentaje,
          detalles: {
            create: parsed.data.items.map((it) => {
              const s = mapStock.get(it.productoId);
              const precioBase = Number(s?.producto.precioVenta || 0);
              const precioFinal = precioBase * factorAumento;

              return {
                productoId: it.productoId,
                unitsEntregadas: it.unitsEntregadas,
                precioUnitario: precioFinal,
                descuento: Number(it.descuento || 0),
              };
            }),
          },
        },
      });

      // âœ… 5. Actualizar Stock en Sucursal, AuditorÃ­a y Alertas
      for (const it of parsed.data.items) {
        const sAntes = mapStock.get(it.productoId)!;

        // A) Mover Stock en la Sucursal (Disponible -> Consignado)
        const sDespues = await tx.stockSucursal.update({
          where: { id: sAntes.id },
          data: {
            stockDisponibleUnits: { decrement: it.unitsEntregadas },
            stockConsignadoUnits: { increment: it.unitsEntregadas },
          },
        });

        // B) Sincronizar Stock Global (legacy support)
        const pDespues = await tx.producto.update({
          where: { id: it.productoId },
          data: {
            stockDisponibleUnits: { decrement: it.unitsEntregadas },
            stockConsignadoUnits: { increment: it.unitsEntregadas },
          },
        });

        // C) Registro de MovimientoStock
        await tx.movimientoStock.create({
          data: {
            productoId: it.productoId,
            sucursalId,
            tipo: TipoMovimientoStock.SALIDA,
            motivo: MotivoMovimientoStock.CONSIGNACION,
            cantidad: it.unitsEntregadas,
            stockPrevio: sAntes.stockDisponibleUnits,
            stockPosterior: sDespues.stockDisponibleUnits,
            observaciones: `Entrega de ConsignaciÃ³n Folio #${nuevoFolio}`,
          },
        });

        const alerta = evaluateStockAlert(pDespues, configGlobal);
        if (alerta) notificationsQueue.push(alerta);
      }

      // Devolver la consignaciÃ³n completa con sus relaciones (opcional, como lo tenÃ­as)
      const consignacionCompleta = await tx.consignacion.findUnique({
        where: { id: consignacion.id },
        include: {
          cliente: true,
          detalles: { include: { producto: true } },
        },
      });

      if (!consignacionCompleta) {
        throw new Error("CONSIGNACION_NO_EXISTE");
      }

      return consignacionCompleta;
    });

    // âœ… 6. DISPARAR NOTIFICACIONES DE STOCK (Centralizado y fuera de la transacciÃ³n)
    await processNotificationQueue(notificationsQueue, auth.activeSucursalId);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    const msg = getErrorMessage(error);

    if (msg === "CLIENTE_NO_EXISTE") {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 },
      );
    }
    if (msg.startsWith("PRODUCTO_NO_ASIGNADO_SUCURSAL:")) {
      return NextResponse.json(
        {
          error: "Producto no asignado a la sucursal",
          productoId: Number(msg.split(":")[1]),
        },
        { status: 404 },
      );
    }
    if (msg.startsWith("STOCK_INSUF:")) {
      return NextResponse.json(
        { error: "Stock insuficiente", productoId: Number(msg.split(":")[1]) },
        { status: 409 },
      );
    }

    console.error("Consignaciones POST error:", error);
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}
