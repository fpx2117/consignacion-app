import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, RolUsuario } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SUBSCRIPTION_PLANS } from "../src/constants/subscriptions";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL no está definido en .env");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function seedUsers() {
  console.log("🔐 Sincronizando usuarios...");

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const agustinEmail = process.env.AGUSTIN_EMAIL;
  const agustinPassword = process.env.AGUSTIN_PASSWORD;

  if (!adminEmail || !adminPassword || !agustinEmail || !agustinPassword) {
    console.warn("⚠️ Faltan credenciales en .env, saltando creación de usuarios.");
    return;
  }

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.usuario.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      nombre: "Administrador",
      email: adminEmail,
      hash: adminHash,
      rol: RolUsuario.ADMIN,
      activo: true,
    },
  });
  console.log("✅ Admin verificado:", admin.email);

  /*
  const agustinHash = await bcrypt.hash(agustinPassword, 10);
  const agustin = await prisma.usuario.upsert({
    where: { email: agustinEmail },
    update: {},
    create: {
      nombre: "Agustin",
      email: agustinEmail,
      hash: agustinHash,
      rol: RolUsuario.EMPLEADO,
      activo: true,
    },
  });
  console.log("✅ Usuario Agustin verificado:", agustin.email);
  */
}

async function seedPlans() {
  console.log("🌱 Sincronizando planes de suscripción...");

  for (const plan of SUBSCRIPTION_PLANS) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: {
        nombre: plan.nombre,
        descripcion: plan.descripcion,
        precioARS: plan.precioARS,
        precioUSD: plan.precioUSD,
        mercadopagoId: plan.mercadopagoId,
        paypalId: plan.paypalId,
      },
      create: {
        id: plan.id,
        nombre: plan.nombre,
        descripcion: plan.descripcion,
        precioARS: plan.precioARS,
        precioUSD: plan.precioUSD,
        mercadopagoId: plan.mercadopagoId,
        paypalId: plan.paypalId,
      },
    });
  }
  console.log("✅ DB sincronizada con SUBSCRIPTION_PLANS.");
}

async function seedPromoCodes() {
  console.log("🎟️ Sincronizando códigos promocionales...");

  const promoCodes = [
    { code: "WELCOME2026", planId: 2, durationDays: 90, maxUses: 100 },
    { code: "ENTERPRISE90", planId: 3, durationDays: 90, maxUses: 50 },
  ];

  for (const promo of promoCodes) {
    await prisma.promoCode.upsert({
      where: { code: promo.code },
      update: {},
      create: promo,
    });
  }
  console.log("✅ Códigos promocionales verificados.");
}

async function main() {
  console.log("🚀 Iniciando Seed Master...");

  await seedUsers();
  await seedPlans();
  await seedPromoCodes();

  console.log("✨ Seed completada con éxito.");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
