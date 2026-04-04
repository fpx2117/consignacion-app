import { PrismaClient, FrecuenciaGasto } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function parseArgs(args: string[]) {
  const target = args.find((arg) => !arg.startsWith("--"));
  const dayArg = args.find((arg) => arg.startsWith("--day="));
  const apply = args.includes("--apply");
  const dayOfMonth = dayArg ? Number(dayArg.split("=")[1]) : null;

  if (!target) throw new Error("Debes indicar un motivo o recurrenciaId objetivo.");
  if (!dayOfMonth || Number.isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    throw new Error("Debes indicar un día válido con --day=27.");
  }

  return { target, dayOfMonth, apply };
}

function alignMonthlyDate(base: Date, dayOfMonth: number) {
  const aligned = new Date(base);
  const lastDayOfMonth = new Date(
    aligned.getFullYear(),
    aligned.getMonth() + 1,
    0,
  ).getDate();

  aligned.setDate(Math.min(dayOfMonth, lastDayOfMonth));
  return aligned;
}

async function main() {
  const { target, dayOfMonth, apply } = parseArgs(process.argv.slice(2));

  const gastos = await prisma.gasto.findMany({
    where: {
      OR: [
        { recurrenciaId: target },
        { motivo: { equals: target, mode: "insensitive" } },
      ],
      esRecurrente: true,
      frecuencia: FrecuenciaGasto.MENSUAL,
      recurrenciaId: { not: null },
      cuotaActual: { not: null },
    },
    orderBy: [{ cuotaActual: "asc" }, { fecha: "asc" }],
  });

  if (!gastos.length) {
    console.log("No se encontraron cuotas materializadas para ajustar.");
    return;
  }

  const preview = gastos.map((gasto) => ({
    id: gasto.id,
    cuotaActual: gasto.cuotaActual,
    fechaActual: gasto.fecha.toISOString(),
    fechaNueva: alignMonthlyDate(gasto.fecha, dayOfMonth).toISOString(),
    recurrenciaId: gasto.recurrenciaId,
    estado: gasto.estado,
  }));

  console.log("Vista previa del realineamiento:");
  console.log(JSON.stringify(preview, null, 2));

  if (!apply) {
    console.log("Dry run. Ejecutá con --apply para guardar cambios.");
    return;
  }

  await prisma.$transaction(
    gastos.map((gasto) => {
      const nextDate = alignMonthlyDate(gasto.fecha, dayOfMonth);

      return prisma.gasto.update({
        where: { id: gasto.id },
        data: {
          fecha: nextDate,
          fechaVencimiento: nextDate,
        },
      });
    }),
  );

  console.log(`Se ajustaron ${gastos.length} cuotas al día ${dayOfMonth}.`);
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
