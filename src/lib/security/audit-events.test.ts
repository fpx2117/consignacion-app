import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDITABLE_SETTINGS_FIELDS,
  consignmentCreated,
  productCreated,
  productDeactivated,
  productUpdated,
  saleCancelled,
  settingsUpdated,
  userCreated,
  userDeleted,
  userUpdated,
} from "./audit-events";

test("userCreated registra a quién se creó y con qué rol", () => {
  const event = userCreated({
    actorId: 1,
    userId: 42,
    email: "nuevo@example.com",
    rol: "EMPLEADO",
    sucursalId: 6,
  });

  assert.equal(event.userId, 1);
  assert.equal(event.action, "CREATE");
  assert.equal(event.module, "USERS");
  assert.deepEqual(event.details, {
    targetUserId: 42,
    email: "nuevo@example.com",
    rol: "EMPLEADO",
    sucursalId: 6,
  });
});

test("userUpdated registra que la contraseña cambió, nunca su valor", () => {
  const event = userUpdated({
    actorId: 1,
    userId: 42,
    email: "user@example.com",
    rol: "ADMIN",
    sucursalId: null,
    passwordChanged: true,
  });

  assert.equal(event.action, "UPDATE");
  assert.equal(event.module, "USERS");
  assert.equal(event.details?.passwordChanged, true);

  const serialized = JSON.stringify(event);
  assert.ok(!serialized.includes("password:"), "no debe incluir un campo password");
  assert.ok(!serialized.includes("hash"), "no debe incluir el hash");
});

test("userDeleted conserva sólo el identificador objetivo", () => {
  const event = userDeleted({ actorId: 7, userId: 42 });

  assert.equal(event.action, "DELETE");
  assert.equal(event.module, "USERS");
  assert.deepEqual(event.details, { targetUserId: 42 });
});

test("productCreated y productUpdated quedan en INVENTORY", () => {
  const created = productCreated({
    actorId: 1,
    productoId: 10,
    nombre: "Perfume",
    sucursalId: 3,
    stockInicial: 12,
  });
  const updated = productUpdated({
    actorId: 1,
    productoId: 10,
    nombre: "Perfume",
    sucursalId: 3,
  });

  assert.equal(created.action, "CREATE");
  assert.equal(created.module, "INVENTORY");
  assert.equal(created.details?.stockInicial, 12);

  assert.equal(updated.action, "UPDATE");
  assert.equal(updated.module, "INVENTORY");
});

test("productDeactivated se registra como borrado lógico", () => {
  const event = productDeactivated({ actorId: 1, productoId: 10, sucursalId: 3 });

  assert.equal(event.action, "DELETE");
  assert.equal(event.module, "INVENTORY");
  assert.equal(event.details?.softDelete, true);
});

test("saleCancelled registra el motivo y las roturas", () => {
  const event = saleCancelled({
    actorId: 5,
    ventaId: 99,
    sucursalId: 2,
    motivo: "Cliente arrepentido",
    roturaCount: 2,
  });

  assert.equal(event.action, "DELETE");
  assert.equal(event.module, "SALES");
  assert.equal(event.details?.ventaId, 99);
  assert.equal(event.details?.motivo, "Cliente arrepentido");
  assert.equal(event.details?.roturaCount, 2);
  assert.equal(event.details?.anulada, true);
});

test("consignmentCreated registra cliente y cantidad de ítems", () => {
  const event = consignmentCreated({
    actorId: 5,
    consignacionId: 30,
    clienteId: 8,
    sucursalId: 2,
    itemsCount: 4,
  });

  assert.equal(event.action, "CREATE");
  assert.equal(event.module, "CONSIGNMENTS");
  assert.equal(event.details?.consignacionId, 30);
  assert.equal(event.details?.itemsCount, 4);
});

test("settingsUpdated descarta credenciales y claves desconocidas", () => {
  const event = settingsUpdated({
    actorId: 1,
    sucursalId: 3,
    fields: [
      "minStockGlobal",
      "tiendaSlug",
      // Secretos: nunca deben llegar al log.
      "mpAccessTokenTienda",
      "mpPublicKeyTienda",
      "andreaniPassword",
      // Clave inventada: se descarta por lista blanca.
      "campoInexistente",
    ],
  });

  assert.equal(event.action, "SETTINGS_CHANGE");
  assert.equal(event.module, "SETTINGS");
  assert.deepEqual(event.details?.fields, ["minStockGlobal", "tiendaSlug"]);

  const serialized = JSON.stringify(event);
  assert.ok(!serialized.includes("mpAccessTokenTienda"));
  assert.ok(!serialized.includes("andreaniPassword"));
});

test("settingsUpdated deduplica y ordena los campos", () => {
  const event = settingsUpdated({
    actorId: 1,
    sucursalId: 3,
    fields: ["tiendaSlug", "minStockGlobal", "tiendaSlug"],
  });

  assert.deepEqual(event.details?.fields, ["minStockGlobal", "tiendaSlug"]);
});

test("la lista blanca de configuración no contiene credenciales", () => {
  for (const field of AUDITABLE_SETTINGS_FIELDS) {
    assert.ok(
      !/password|token|secret|key|clave/i.test(field),
      `el campo "${field}" parece una credencial y no debería auditarse`,
    );
  }
});
