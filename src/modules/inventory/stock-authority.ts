import type { Prisma } from "@prisma/client";

export const STOCK_AUTHORITY_MODES = [
  "APP_DUAL_WRITE",
  "DB_PROJECTION",
] as const;

export type StockAuthorityMode = (typeof STOCK_AUTHORITY_MODES)[number];

export type StockAuthority = {
  mode: StockAuthorityMode;
  projection: boolean;
};

export type StockAuthorityErrorCode =
  | "STOCK_AUTHORITY_MISSING"
  | "STOCK_AUTHORITY_UNKNOWN"
  | "STOCK_AUTHORITY_INCOMPATIBLE";

export class StockAuthorityError extends Error {
  constructor(readonly code: StockAuthorityErrorCode) {
    super("Autoridad de stock no disponible.");
    this.name = "StockAuthorityError";
  }
}

type AuthorityRow = { modo: string; projection: number };

/*
 * Reads the persisted capability and locks its row for the rest of the
 * transaction. Holding FOR SHARE prevents a compensation from switching modes
 * while this writer is in flight. The projection trigger must match the mode:
 * APP_DUAL_WRITE expects no projection; DB_PROJECTION expects it installed.
 */
export async function lockStockAuthority(
  client: Prisma.TransactionClient,
): Promise<StockAuthority> {
  const rows = await client.$queryRaw<AuthorityRow[]>`
    SELECT autoridad."modo" AS "modo",
           (
             SELECT COUNT(*)::int
             FROM pg_catalog.pg_trigger AS trigger
             WHERE trigger.tgrelid = 'public."StockSucursal"'::regclass
               AND trigger.tgname = 'trg_sync_producto_stock'
               AND NOT trigger.tgisinternal
               AND trigger.tgenabled IN ('O', 'A')
           ) AS "projection"
    FROM public."StockAutoridad" AS autoridad
    WHERE autoridad."id" = 1
    FOR SHARE OF autoridad
  `;

  if (rows.length !== 1) {
    throw new StockAuthorityError("STOCK_AUTHORITY_MISSING");
  }

  const mode = rows[0].modo;
  if (!STOCK_AUTHORITY_MODES.includes(mode as StockAuthorityMode)) {
    throw new StockAuthorityError("STOCK_AUTHORITY_UNKNOWN");
  }

  const projection = Number(rows[0].projection) > 0;
  const compatible =
    mode === "APP_DUAL_WRITE" ? !projection : projection;
  if (!compatible) {
    throw new StockAuthorityError("STOCK_AUTHORITY_INCOMPATIBLE");
  }

  return { mode: mode as StockAuthorityMode, projection };
}

/*
 * Applies a global Producto delta exactly once.
 *
 * APP_DUAL_WRITE has no trigger, so the global field must be updated atomically
 * by delta. Recomputing Producto = SUM inside concurrent transactions on
 * different sucursales loses updates (each transaction can read the other's
 * uncommitted stock as its previous value).
 *
 * DB_PROJECTION writes only StockSucursal; the projection owns Producto, so
 * this function only reads the already-projected row.
 */
export async function applyProductoGlobalDelta(
  client: Prisma.TransactionClient,
  authority: StockAuthority,
  input: {
    productoId: number;
    disponibleDelta: number;
    consignadoDelta: number;
  },
) {
  if (authority.mode === "DB_PROJECTION") {
    return client.producto.findUniqueOrThrow({
      where: { id: input.productoId },
    });
  }

  return client.producto.update({
    where: { id: input.productoId },
    data: {
      stockDisponibleUnits: { increment: input.disponibleDelta },
      stockConsignadoUnits: { increment: input.consignadoDelta },
    },
  });
}

/**
 * Movimiento derivado del estado persistido: el post-image ya está en la fila y
 * el previo se reconstruye con el delta aplicado. Es el orden que se guarda en
 * MovimientoStock (stockPrevio / stockPosterior).
 */
export function calculateStockTransition(
  post: number,
  appliedDelta: number,
): { prev: number; post: number } {
  return { prev: post - appliedDelta, post };
}

function assertPositiveUnits(units: number) {
  if (!Number.isInteger(units) || units <= 0) {
    throw new Error("Stock transition units must be a positive integer");
  }
}

export async function incrementBranchStock(
  client: Prisma.TransactionClient,
  authority: StockAuthority,
  input: { productoId: number; sucursalId: number; units: number },
) {
  assertPositiveUnits(input.units);
  const row = await client.stockSucursal.upsert({
    where: {
      productoId_sucursalId: {
        productoId: input.productoId,
        sucursalId: input.sucursalId,
      },
    },
    create: {
      productoId: input.productoId,
      sucursalId: input.sucursalId,
      stockDisponibleUnits: input.units,
      stockConsignadoUnits: 0,
      stockMinUnits: 0,
    },
    update: {
      stockDisponibleUnits: { increment: input.units },
    },
  });

  const { prev, post } = calculateStockTransition(
    row.stockDisponibleUnits,
    input.units,
  );

  await applyProductoGlobalDelta(client, authority, {
    productoId: input.productoId,
    disponibleDelta: input.units,
    consignadoDelta: 0,
  });

  return { prev, post };
}

export async function decrementBranchStock(
  client: Prisma.TransactionClient,
  authority: StockAuthority,
  input: { productoId: number; sucursalId: number; units: number },
) {
  assertPositiveUnits(input.units);
  const updated = await client.stockSucursal.updateMany({
    where: {
      productoId: input.productoId,
      sucursalId: input.sucursalId,
      stockDisponibleUnits: { gte: input.units },
    },
    data: { stockDisponibleUnits: { decrement: input.units } },
  });

  if (updated.count === 0) {
    return null;
  }

  const row = await client.stockSucursal.findUniqueOrThrow({
    where: {
      productoId_sucursalId: {
        productoId: input.productoId,
        sucursalId: input.sucursalId,
      },
    },
    select: { stockDisponibleUnits: true },
  });
  const { prev, post } = calculateStockTransition(
    row.stockDisponibleUnits,
    -input.units,
  );

  await applyProductoGlobalDelta(client, authority, {
    productoId: input.productoId,
    disponibleDelta: -input.units,
    consignadoDelta: 0,
  });

  return { prev, post };
}
