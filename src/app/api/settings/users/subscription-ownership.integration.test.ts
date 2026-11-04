// Verifica la regla del ADR 002: la suscripción pertenece a la instalación y su
// `userId` es solo el contacto de facturación. Al eliminar ese contacto, la
// suscripción se reasigna a otro administrador activo en lugar de romper el
// borrado por la FK `ON DELETE RESTRICT`.
//
// Requiere TEST_DATABASE_URL porque escribe en una base real. No hace TRUNCATE:
// crea filas con identificadores únicos y las borra al final.

import assert from "node:assert/strict";
import test from "node:test";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL es obligatoria para esta prueba de integración");
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

test("eliminar al contacto de facturación reasigna la suscripción a otro admin", async (t) => {
  process.env.DATABASE_URL = databaseUrl;

  const [
    { prisma },
    { deleteUserAndProtectLastAdmin },
    { getActivePlanLimits },
  ] = await Promise.all([
    import("@/lib/prisma"),
    import("@/app/api/settings/users/user-update"),
    import("@/lib/subscriptions/require-subscription"),
  ]);

  const createdUserIds: number[] = [];
  let planId: number | null = null;

  t.after(async () => {
    // Orden de borrado respetando las claves foráneas.
    try {
      await prisma.subscription.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      if (planId !== null) {
        await prisma.subscription.deleteMany({ where: { planId } });
        await prisma.plan.delete({ where: { id: planId } });
      }
      await prisma.usuario.deleteMany({ where: { id: { in: createdUserIds } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  const owner = await prisma.usuario.create({
    data: {
      nombre: "Contacto de facturación",
      email: `billing-owner-${runId}@example.test`,
      hash: "not-a-real-hash",
      rol: "ADMIN",
      sucursalId: null,
    },
    select: { id: true },
  });
  createdUserIds.push(owner.id);

  const successor = await prisma.usuario.create({
    data: {
      nombre: "Administrador sucesor",
      email: `billing-successor-${runId}@example.test`,
      hash: "not-a-real-hash",
      rol: "ADMIN",
      sucursalId: null,
    },
    select: { id: true },
  });
  createdUserIds.push(successor.id);

  const plan = await prisma.plan.create({
    data: {
      nombre: `Plan de prueba ${runId}`,
      precioARS: 0,
      precioUSD: 0,
      activo: false,
    },
    select: { id: true },
  });
  planId = plan.id;

  const subscription = await prisma.subscription.create({
    data: {
      userId: owner.id,
      planId: plan.id,
      provider: "PROMO",
      externalId: `promo-${runId}`,
      status: "ACTIVO",
    },
    select: { id: true, userId: true },
  });

  assert.equal(subscription.userId, owner.id);

  const deleted = await deleteUserAndProtectLastAdmin(owner.id, {
    allowedSucursalIds: [],
    isGlobalView: true,
  });

  assert.equal(deleted, true, "el borrado debe completarse, no fallar por la FK");

  const ownerAfter = await prisma.usuario.findUnique({
    where: { id: owner.id },
    select: { id: true },
  });
  assert.equal(ownerAfter, null, "el contacto de facturación debe quedar eliminado");

  const subscriptionAfter = await prisma.subscription.findUnique({
    where: { id: subscription.id },
    select: { userId: true, planId: true, status: true },
  });

  assert.ok(subscriptionAfter, "la suscripción no debe desaparecer");
  assert.notEqual(
    subscriptionAfter.userId,
    owner.id,
    "no puede seguir apuntando al usuario eliminado",
  );

  // La invariante es "queda a cargo un administrador activo sin otra
  // suscripción", no un id puntual: el entorno puede tener otros admins.
  const newContact = await prisma.usuario.findUnique({
    where: { id: subscriptionAfter.userId },
    select: { rol: true, activo: true, subscription: { select: { id: true } } },
  });

  assert.ok(newContact, "el nuevo contacto debe existir");
  assert.equal(newContact.rol, "ADMIN", "el nuevo contacto debe ser administrador");
  assert.equal(newContact.activo, true, "el nuevo contacto debe estar activo");
  assert.equal(
    newContact.subscription?.id,
    subscription.id,
    "el nuevo contacto no debe tener otra suscripción",
  );

  assert.equal(subscriptionAfter.planId, plan.id, "el plan no debe cambiar");
  assert.equal(subscriptionAfter.status, "ACTIVO", "el estado no debe cambiar");

  // La lectura de límites es a nivel instalación: `findFirst` de cualquier
  // suscripción activa. Sigue funcionando después de perder al contacto.
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  try {
    const limits = await getActivePlanLimits();
    assert.ok(limits, "debe seguir habiendo un plan activo tras la reasignación");
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
