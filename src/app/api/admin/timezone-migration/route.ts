import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { getConfiguredTz } from "@/lib/timezone/get-configured-tz";

// ─── Tablas/columnas a corregir ──────────────────────────────────────────────

const MIGRATION_TARGETS = [
  { tabla: "Venta", columna: "fecha", nullable: false },
  { tabla: "Venta", columna: "fechaAnulacion", nullable: true },
  { tabla: "Pago", columna: "fecha", nullable: false },
  { tabla: "Consignacion", columna: "fecha", nullable: false },
  { tabla: "Liquidacion", columna: "fecha", nullable: false },
  { tabla: "Gasto", columna: "fecha", nullable: false },
  { tabla: "SesionCaja", columna: "fechaApertura", nullable: false },
  { tabla: "SesionCaja", columna: "fechaCierre", nullable: true },
  { tabla: "MovimientoCaja", columna: "fecha", nullable: false },
  { tabla: "MovimientoStock", columna: "createdAt", nullable: false },
] as const;

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TablaInfo = {
  tabla: string;
  columna: string;
  registros: number;
  sample_stored: string | null;
  sample_corrected: string | null;
};

type GetResponseData = {
  serverTz: string;
  configuredTz: string;
  offsetHours: number;
  needsMigration: boolean;
  timezoneMigrationDone: boolean;
  tablas: TablaInfo[];
};

type TargetResult = {
  tabla: string;
  columna: string;
  updated: number;
};

type PostBody = {
  dryRun: boolean;
  confirmar: boolean;
  offsetHours: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calcula cuántas horas está adelantada la DB (UTC) respecto a la TZ configurada.
 * Para America/Argentina/Buenos_Aires (UTC-3) → devuelve 3.
 */
function calcOffsetHours(ianaTimezone: string): number {
  const now = new Date();
  const tzStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: ianaTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

  const tzMs = new Date(tzStr.replace(",", "") + "Z").getTime();
  const diffMs = now.getTime() - tzMs;
  return Math.round(diffMs / 3_600_000);
}

/** Formatea un Date UTC como "YYYY-MM-DD HH:MM:SS" */
function fmtTs(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  );
}

/** Cuenta filas de una tabla/columna. Usa switch para respetar el requisito de templates estáticos de Prisma. */
async function countRows(key: string): Promise<number> {
  switch (key) {
    case "Venta.fecha":
      return Number(
        (
          await prisma.$queryRaw<
            [{ count: bigint }]
          >`SELECT COUNT(*) as count FROM "Venta"`
        )[0]?.count ?? 0,
      );
    case "Venta.fechaAnulacion":
      return Number(
        (
          await prisma.$queryRaw<
            [{ count: bigint }]
          >`SELECT COUNT(*) as count FROM "Venta" WHERE "fechaAnulacion" IS NOT NULL`
        )[0]?.count ?? 0,
      );
    case "Pago.fecha":
      return Number(
        (
          await prisma.$queryRaw<
            [{ count: bigint }]
          >`SELECT COUNT(*) as count FROM "Pago"`
        )[0]?.count ?? 0,
      );
    case "Consignacion.fecha":
      return Number(
        (
          await prisma.$queryRaw<
            [{ count: bigint }]
          >`SELECT COUNT(*) as count FROM "Consignacion"`
        )[0]?.count ?? 0,
      );
    case "Liquidacion.fecha":
      return Number(
        (
          await prisma.$queryRaw<
            [{ count: bigint }]
          >`SELECT COUNT(*) as count FROM "Liquidacion"`
        )[0]?.count ?? 0,
      );
    case "Gasto.fecha":
      return Number(
        (
          await prisma.$queryRaw<
            [{ count: bigint }]
          >`SELECT COUNT(*) as count FROM "Gasto"`
        )[0]?.count ?? 0,
      );
    case "SesionCaja.fechaApertura":
      return Number(
        (
          await prisma.$queryRaw<
            [{ count: bigint }]
          >`SELECT COUNT(*) as count FROM "SesionCaja"`
        )[0]?.count ?? 0,
      );
    case "SesionCaja.fechaCierre":
      return Number(
        (
          await prisma.$queryRaw<
            [{ count: bigint }]
          >`SELECT COUNT(*) as count FROM "SesionCaja" WHERE "fechaCierre" IS NOT NULL`
        )[0]?.count ?? 0,
      );
    case "MovimientoCaja.fecha":
      return Number(
        (
          await prisma.$queryRaw<
            [{ count: bigint }]
          >`SELECT COUNT(*) as count FROM "MovimientoCaja"`
        )[0]?.count ?? 0,
      );
    case "MovimientoStock.createdAt":
      return Number(
        (
          await prisma.$queryRaw<
            [{ count: bigint }]
          >`SELECT COUNT(*) as count FROM "MovimientoStock"`
        )[0]?.count ?? 0,
      );
    default:
      return 0;
  }
}

/** Obtiene el valor de muestra más reciente para una tabla/columna. */
async function getSample(key: string): Promise<Date | null> {
  switch (key) {
    case "Venta.fecha": {
      const rows = await prisma.$queryRaw<
        [{ fecha: Date }]
      >`SELECT "fecha" FROM "Venta" ORDER BY "fecha" DESC LIMIT 1`;
      return rows[0]?.fecha ?? null;
    }
    case "Venta.fechaAnulacion": {
      const rows = await prisma.$queryRaw<
        [{ fechaAnulacion: Date }]
      >`SELECT "fechaAnulacion" FROM "Venta" WHERE "fechaAnulacion" IS NOT NULL ORDER BY "fechaAnulacion" DESC LIMIT 1`;
      return rows[0]?.fechaAnulacion ?? null;
    }
    case "Pago.fecha": {
      const rows = await prisma.$queryRaw<
        [{ fecha: Date }]
      >`SELECT "fecha" FROM "Pago" ORDER BY "fecha" DESC LIMIT 1`;
      return rows[0]?.fecha ?? null;
    }
    case "Consignacion.fecha": {
      const rows = await prisma.$queryRaw<
        [{ fecha: Date }]
      >`SELECT "fecha" FROM "Consignacion" ORDER BY "fecha" DESC LIMIT 1`;
      return rows[0]?.fecha ?? null;
    }
    case "Liquidacion.fecha": {
      const rows = await prisma.$queryRaw<
        [{ fecha: Date }]
      >`SELECT "fecha" FROM "Liquidacion" ORDER BY "fecha" DESC LIMIT 1`;
      return rows[0]?.fecha ?? null;
    }
    case "Gasto.fecha": {
      const rows = await prisma.$queryRaw<
        [{ fecha: Date }]
      >`SELECT "fecha" FROM "Gasto" ORDER BY "fecha" DESC LIMIT 1`;
      return rows[0]?.fecha ?? null;
    }
    case "SesionCaja.fechaApertura": {
      const rows = await prisma.$queryRaw<
        [{ fechaApertura: Date }]
      >`SELECT "fechaApertura" FROM "SesionCaja" ORDER BY "fechaApertura" DESC LIMIT 1`;
      return rows[0]?.fechaApertura ?? null;
    }
    case "SesionCaja.fechaCierre": {
      const rows = await prisma.$queryRaw<
        [{ fechaCierre: Date }]
      >`SELECT "fechaCierre" FROM "SesionCaja" WHERE "fechaCierre" IS NOT NULL ORDER BY "fechaCierre" DESC LIMIT 1`;
      return rows[0]?.fechaCierre ?? null;
    }
    case "MovimientoCaja.fecha": {
      const rows = await prisma.$queryRaw<
        [{ fecha: Date }]
      >`SELECT "fecha" FROM "MovimientoCaja" ORDER BY "fecha" DESC LIMIT 1`;
      return rows[0]?.fecha ?? null;
    }
    case "MovimientoStock.createdAt": {
      const rows = await prisma.$queryRaw<
        [{ createdAt: Date }]
      >`SELECT "createdAt" FROM "MovimientoStock" ORDER BY "createdAt" DESC LIMIT 1`;
      return rows[0]?.createdAt ?? null;
    }
    default:
      return null;
  }
}

// ─── GET — Diagnóstico (solo lectura) ────────────────────────────────────────

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    // 1. Timezone del servidor PostgreSQL
    const tzResult = await prisma.$queryRaw<
      [{ TimeZone: string }]
    >`SHOW timezone`;
    const serverTz = tzResult[0]?.TimeZone ?? "Etc/UTC";

    // 2. Timezone configurada en la sucursal activa + flag de migración
    const configuredTz = await getConfiguredTz(auth.activeSucursalId);

    const configRow = await prisma.configuracion.findUnique({
      where: { sucursalId: auth.activeSucursalId },
      select: { timezoneMigrationDone: true },
    });
    const timezoneMigrationDone = configRow?.timezoneMigrationDone ?? false;

    // 3. Calcular offset (horas que la DB tiene adelantadas)
    const offsetHours = calcOffsetHours(configuredTz);

    // 4. Si ya se migró → retornar sin necesidad de migración
    if (timezoneMigrationDone) {
      const data: GetResponseData = {
        serverTz,
        configuredTz,
        offsetHours,
        needsMigration: false,
        timezoneMigrationDone: true,
        tablas: [],
      };
      return NextResponse.json({ data });
    }

    // 5. Si no hay offset → no hay problema
    if (offsetHours === 0) {
      const data: GetResponseData = {
        serverTz,
        configuredTz,
        offsetHours: 0,
        needsMigration: false,
        timezoneMigrationDone: false,
        tablas: [],
      };
      return NextResponse.json({ data });
    }

    // 6. Contar registros y obtener samples para cada target
    const tablas: TablaInfo[] = [];

    for (const target of MIGRATION_TARGETS) {
      const key = `${target.tabla}.${target.columna}`;
      const registros = await countRows(key);
      const sample = await getSample(key);

      let sampleStored: string | null = null;
      let sampleCorrected: string | null = null;

      if (sample) {
        sampleStored = fmtTs(sample);
        sampleCorrected = fmtTs(
          new Date(sample.getTime() - offsetHours * 3_600_000),
        );
      }

      tablas.push({
        tabla: target.tabla,
        columna: target.columna,
        registros,
        sample_stored: sampleStored,
        sample_corrected: sampleCorrected,
      });
    }

    const data: GetResponseData = {
      serverTz,
      configuredTz,
      offsetHours,
      needsMigration: true,
      timezoneMigrationDone: false,
      tablas,
    };

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[GET /api/admin/timezone-migration]", error);
    return NextResponse.json(
      { error: "Error ejecutando diagnóstico de timezone" },
      { status: 500 },
    );
  }
}

// ─── POST — Corrección de datos ───────────────────────────────────────────────

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json(
      { error: "No autorizado. Se requiere rol ADMIN." },
      { status: 403 },
    );
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const { dryRun, confirmar, offsetHours } = body;

  if (!confirmar) {
    return NextResponse.json(
      { error: "Debe confirmar la operación enviando confirmar: true" },
      { status: 400 },
    );
  }

  if (!Number.isFinite(offsetHours) || offsetHours <= 0) {
    return NextResponse.json(
      { error: "offsetHours debe ser un número positivo" },
      { status: 400 },
    );
  }

  // Verificar idempotencia
  const configRow = await prisma.configuracion.findUnique({
    where: { sucursalId: auth.activeSucursalId },
    select: { timezoneMigrationDone: true },
  });

  if (configRow?.timezoneMigrationDone === true) {
    return NextResponse.json(
      {
        error:
          "La migración ya fue ejecutada anteriormente (timezoneMigrationDone = true). No se puede ejecutar dos veces.",
      },
      { status: 409 },
    );
  }

  const interval = `${offsetHours} hours`;

  // ── DRY RUN ──────────────────────────────────────────────────────────────────
  if (dryRun) {
    const targets: TargetResult[] = [];

    for (const target of MIGRATION_TARGETS) {
      const key = `${target.tabla}.${target.columna}`;
      const updated = await countRows(key);
      targets.push({ tabla: target.tabla, columna: target.columna, updated });
    }

    return NextResponse.json({
      data: {
        dryRun: true,
        offsetHours,
        interval,
        message:
          "DRY-RUN: ningún dato fue modificado. Se afectarían los registros indicados.",
        targets,
      },
    });
  }

  // ── EJECUCIÓN REAL ────────────────────────────────────────────────────────────
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "Venta" SET "fecha" = "fecha" - ${interval}::interval`;
      await tx.$executeRaw`UPDATE "Venta" SET "fechaAnulacion" = "fechaAnulacion" - ${interval}::interval WHERE "fechaAnulacion" IS NOT NULL`;
      await tx.$executeRaw`UPDATE "Pago" SET "fecha" = "fecha" - ${interval}::interval`;
      await tx.$executeRaw`UPDATE "Consignacion" SET "fecha" = "fecha" - ${interval}::interval`;
      await tx.$executeRaw`UPDATE "Liquidacion" SET "fecha" = "fecha" - ${interval}::interval`;
      await tx.$executeRaw`UPDATE "Gasto" SET "fecha" = "fecha" - ${interval}::interval`;
      await tx.$executeRaw`UPDATE "SesionCaja" SET "fechaApertura" = "fechaApertura" - ${interval}::interval`;
      await tx.$executeRaw`UPDATE "SesionCaja" SET "fechaCierre" = "fechaCierre" - ${interval}::interval WHERE "fechaCierre" IS NOT NULL`;
      await tx.$executeRaw`UPDATE "MovimientoCaja" SET "fecha" = "fecha" - ${interval}::interval`;
      await tx.$executeRaw`UPDATE "MovimientoStock" SET "createdAt" = "createdAt" - ${interval}::interval`;

      await tx.configuracion.update({
        where: { sucursalId: auth.activeSucursalId },
        data: { timezoneMigrationDone: true },
      });
    });

    const targets: TargetResult[] = [];
    for (const target of MIGRATION_TARGETS) {
      const key = `${target.tabla}.${target.columna}`;
      const updated = await countRows(key);
      targets.push({ tabla: target.tabla, columna: target.columna, updated });
    }

    return NextResponse.json({
      data: {
        dryRun: false,
        offsetHours,
        interval,
        message: `Migración completada. timezoneMigrationDone = true. Todas las fechas fueron ajustadas -${offsetHours}h.`,
        targets,
      },
    });
  } catch (error) {
    console.error("[POST /api/admin/timezone-migration]", error);
    return NextResponse.json(
      {
        error:
          "Error ejecutando la migración de timezone. La transacción fue revertida.",
      },
      { status: 500 },
    );
  }
}
