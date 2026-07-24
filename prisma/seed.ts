import { PrismaClient, RolUsuario } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";
import { SUBSCRIPTION_PLANS } from "../src/constants/subscriptions";

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedPlans() {
  console.log("🌱 Sincronizando planes de suscripción...");

  // Usamos Promise.all para que sea más rápido, o un for...of para seguridad
  for (const plan of SUBSCRIPTION_PLANS) {
    console.log(`Upserting plan: ${plan.id} (${plan.nombre})...`);
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
    { code: "AGUSTIN2026", planId: 2, durationDays: 90, maxUses: 1 },
    { code: "A-DATA2026", planId: 3, durationDays: 90, maxUses: 1 },
    { code: "PROMOCODE", planId: 3, durationDays: 365, maxUses: 999 },
  ];

  for (const promo of promoCodes) {
    // Verificamos si el planId existe antes de crear el promo code para evitar errores de FK
    const planExists = await prisma.plan.findUnique({
      where: { id: promo.planId },
    });

    if (planExists) {
      console.log(`Upserting promo code: ${promo.code}...`);
      await prisma.promoCode.upsert({
        where: { code: promo.code },
        update: {
          planId: promo.planId,
          durationDays: promo.durationDays,
          maxUses: promo.maxUses,
        },
        create: promo,
      });
    } else {
      console.warn(
        `⚠️ Saltando promo ${promo.code}: Plan ID ${promo.planId} no encontrado.`,
      );
    }
  }
  console.log("✅ Códigos promocionales verificados.");
}

async function main() {
  try {
    console.log("🚀 Iniciando Seed Master...");
    // Conectar explícitamente
    await prisma.$connect();

    await seedPlans();
    await seedPromoCodes();

    console.log("✨ Seed completada con éxito.");
  } catch (error) {
    console.error("❌ Error durante la ejecución del seed:");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
