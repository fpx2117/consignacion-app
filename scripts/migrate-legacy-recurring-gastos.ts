import {
  PrismaClient,
  Prisma,
  EstadoGasto,
  FrecuenciaGasto,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type LegacyGasto = Prisma.GastoGetPayload<{
  include: { sucursalesCompartidas: true; categoria: true };
}>;

function addOccurrence(date: Date, frecuencia: FrecuenciaGasto) {
  const next = new Date(date);

  if (frecuencia === "MENSUAL") next.setMonth(next.getMonth() + 1);
  else if (frecuencia === "SEMANAL") next.setDate(next.getDate() + 7);
  else if (frecuencia === "ANUAL") next.setFullYear(next.getFullYear() + 1);

  return next;
}

function alignMonthlyDay(date: Date, dayOfMonth: number | null) {
  if (!dayOfMonth) return new Date(date);

  const aligned = new Date(date);
  const lastDayOfMonth = new Date(
    aligned.getFullYear(),
    aligned.getMonth() + 1,
    0,
  ).getDate();

  aligned.setDate(Math.min(dayOfMonth, lastDayOfMonth));
  return aligned;
}

function buildOccurrences(
  startDate: Date,
  endDate: Date,
  frecuencia: FrecuenciaGasto,
  dayOfMonth: number | null,
) {
  const dates: Date[] = [];
  let current =
    frecuencia === "MENSUAL"
      ? alignMonthlyDay(startDate, dayOfMonth)
      : new Date(startDate);

  while (current <= endDate) {
    dates.push(new Date(current));
    current = addOccurrence(current, frecuencia);

    if (frecuencia === "MENSUAL") {
      current = alignMonthlyDay(current, dayOfMonth);
    }
  }

  return dates;
}

function buildRecurrenciaId() {
  return Math.random().toString(36).substring(2, 11).toUpperCase();
}

async function findLegacyGastos(target: string | undefined) {
  return prisma.gasto.findMany({
    where: {
      esRecurrente: true,
      recurrenciaId: null,
      cuotaActual: null,
      cuotaTotal: null,
      fechaVencimiento: { not: null },
      frecuencia: { in: ["MENSUAL", "SEMANAL", "ANUAL"] },
      ...(target
        ? {
            OR: [
              Number.isFinite(Number(target))
                ? { id: Number(target) }
                : undefined,
              { motivo: { contains: target, mode: "insensitive" } },
            ].filter(Boolean) as Prisma.GastoWhereInput[],
          }
        : {}),
    },
    include: {
      categoria: true,
      sucursalesCompartidas: true,
    },
    orderBy: { id: "asc" },
  });
}

async function migrateLegacyGasto(
  gasto: LegacyGasto,
  dayOfMonth: number | null,
) {
  const endDate = gasto.fechaVencimiento;

  if (!endDate) {
    throw new Error(`Gasto ${gasto.id} sin fecha final`);
  }

  const dates = buildOccurrences(
    gasto.fecha,
    endDate,
    gasto.frecuencia,
    dayOfMonth,
  );

  if (dates.length <= 1) {
    return {
      gastoId: gasto.id,
      motivo: gasto.motivo,
      migrated: false,
      reason: "No genera más de una cuota",
    };
  }

  const recurrenciaId = buildRecurrenciaId();

  await prisma.$transaction(async (tx) => {
    await tx.gasto.update({
      where: { id: gasto.id },
      data: {
        recurrenciaId,
        cuotaActual: 1,
        cuotaTotal: dates.length,
        fechaVencimiento: dates[0],
      },
    });

    for (let index = 1; index < dates.length; index++) {
      const cuotaDate = dates[index];
      const created = await tx.gasto.create({
        data: {
          monto: gasto.monto,
          fecha: cuotaDate,
          fechaVencimiento: cuotaDate,
          motivo: gasto.motivo,
          estado: "PENDIENTE" satisfies EstadoGasto,
          esRecurrente: true,
          frecuencia: gasto.frecuencia,
          categoriaGastoId: gasto.categoriaGastoId,
          sucursalId: gasto.sucursalId,
          userId: gasto.userId,
          comprobanteUrl: null,
          cuotaActual: index + 1,
          cuotaTotal: dates.length,
          recurrenciaId,
          esCompartido: gasto.esCompartido,
        },
      });

      if (gasto.esCompartido && gasto.sucursalesCompartidas.length > 0) {
        await tx.gastoSucursal.createMany({
          data: gasto.sucursalesCompartidas.map((link) => ({
            gastoId: created.id,
            sucursalId: link.sucursalId,
            montoProporcional: link.montoProporcional,
          })),
        });
      }
    }
  });

  return {
    gastoId: gasto.id,
    motivo: gasto.motivo,
    migrated: true,
    recurrenciaId,
    cuotas: dates.map((date, index) => ({
      cuota: index + 1,
      fecha: date.toISOString(),
      estado: index === 0 ? gasto.estado : "PENDIENTE",
    })),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dayArg = args.find((arg) => arg.startsWith("--day="));
  const target = args.find((arg) => !arg.startsWith("--"));
  const dayOfMonth = dayArg ? Number(dayArg.split("=")[1]) : null;
  const legacyGastos = await findLegacyGastos(target);

  if (legacyGastos.length === 0) {
    console.log("No se encontraron gastos legacy para migrar.");
    return;
  }

  const preview = legacyGastos.map((gasto) => ({
    id: gasto.id,
    motivo: gasto.motivo,
    fecha: gasto.fecha.toISOString(),
    fechaVencimiento: gasto.fechaVencimiento?.toISOString(),
    frecuencia: gasto.frecuencia,
    estado: gasto.estado,
    monto: Number(gasto.monto),
    sucursalId: gasto.sucursalId,
  }));

  console.log("Legacy detectados:");
  console.log(JSON.stringify(preview, null, 2));

  if (!apply) {
    console.log("Dry run. Ejecutá con --apply para migrar.");
    return;
  }

  const results = [];

  for (const gasto of legacyGastos) {
    results.push(await migrateLegacyGasto(gasto, dayOfMonth));
  }

  console.log("Migración completada:");
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
