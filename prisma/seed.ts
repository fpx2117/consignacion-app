import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, RolUsuario } from "@prisma/client";
import { SUBSCRIPTION_PLANS } from "@/constants/subscriptions";

// Inicialización estándar de Prisma (El adaptador suele ser necesario solo en Edge Runtime)
// Para un script de seed, la conexión directa es más estable
const prisma = new PrismaClient();

async function seedUsers() {
  console.log("🔐 Sincronizando usuarios...");

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn("⚠️ Faltan credenciales ADMIN en .env, saltando.");
    return;
  }

  const adminHash = await bcrypt.hash(adminPassword, 10);

  await prisma.usuario.upsert({
    where: { email: adminEmail },
    update: {
      hash: adminHash, // Actualizamos el hash por si cambió en el .env
    },
    create: {
      nombre: "Administrador",
      email: adminEmail,
      hash: adminHash,
      rol: RolUsuario.ADMIN,
      activo: true,
    },
  });
  console.log("✅ Admin verificado:", adminEmail);
}

async function seedPlans() {
  console.log("🌱 Sincronizando planes de suscripción...");

  // Usamos Promise.all para que sea más rápido, o un for...of para seguridad
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
    { code: "IMPORT.VPS", planId: 2, durationDays: 90, maxUses: 1 },
    { code: "WELCOME.VPS", planId: 3, durationDays: 90, maxUses: 1 },
  ];

  for (const promo of promoCodes) {
    // Verificamos si el planId existe antes de crear el promo code para evitar errores de FK
    const planExists = await prisma.plan.findUnique({ where: { id: promo.planId } });

    if (planExists) {
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
      console.warn(`⚠️ Saltando promo ${promo.code}: Plan ID ${promo.planId} no encontrado.`);
    }
  }
  console.log("✅ Códigos promocionales verificados.");
}

async function main() {
  try {
    console.log("🚀 Iniciando Seed Master...");
    // Conectar explícitamente
    await prisma.$connect();

    await seedUsers();
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