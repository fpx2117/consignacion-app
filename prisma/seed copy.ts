import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, RolUsuario } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL no está definido en .env");
}

// Prisma 7: requiere adapter (o accelerateUrl)
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seed iniciada...");

  const hashedPassword = await bcrypt.hash("123456", 10);

  const admin = await prisma.usuario.upsert({
    where: { email: "admin@admin.com" },
    update: {},
    create: {
      nombre: "Administrador",
      email: "admin@admin.com",
      hash: hashedPassword,
      rol: RolUsuario.ADMIN,
      activo: true,
    },
  });

  console.log("✅ Admin listo:", { id: admin.id, email: admin.email, rol: admin.rol });
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("🌱 Seed finalizada.");
  });
