import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, RolUsuario } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL no está definido en .env");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seed iniciada...");

  // ===============================
  // 🔐 Variables desde .env
  // ===============================
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  const agustinEmail = process.env.AGUSTIN_EMAIL;
  const agustinPassword = process.env.AGUSTIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error("Faltan ADMIN_EMAIL o ADMIN_PASSWORD en el .env");
  }

  if (!agustinEmail || !agustinPassword) {
    throw new Error("Faltan AGUSTIN_EMAIL o AGUSTIN_PASSWORD en el .env");
  }

  // ===============================
  // 👑 Cuenta Admin
  // ===============================
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

  console.log("✅ Admin creado:", admin.email);

  // ===============================
  // 👤 Cuenta Agustin
  // ===============================
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

  console.log("✅ Usuario Agustin creado:", agustin.email);

  console.log("🌱 Seed completada con éxito.");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
