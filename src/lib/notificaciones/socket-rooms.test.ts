import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveNotificationRoom,
  resolveSocketRooms,
  SOCKET_ROOMS,
} from "@/lib/notificaciones/socket-rooms";

test("un socket autenticado se une sólo a sus salas", async (t) => {
  await t.test("instalación, usuario y sucursal activa", () => {
    assert.deepEqual(
      resolveSocketRooms({ userId: 7, activeSucursalId: 3 }),
      [SOCKET_ROOMS.install, "user:7", "branch:3"],
    );
  });

  await t.test("vista global escucha las sucursales que puede ver", () => {
    assert.deepEqual(
      resolveSocketRooms({
        userId: 7,
        activeSucursalId: null,
        visibleSucursalIds: [1, 2, 2, 0, -3],
      }),
      [SOCKET_ROOMS.install, "user:7", "branch:1", "branch:2"],
    );
  });

  await t.test("vista global sin sucursales visibles no crea salas de sucursal", () => {
    assert.deepEqual(
      resolveSocketRooms({ userId: 7, activeSucursalId: null }),
      [SOCKET_ROOMS.install, "user:7"],
    );
  });

  await t.test("con sucursal activa ignora las visibles", () => {
    assert.deepEqual(
      resolveSocketRooms({
        userId: 7,
        activeSucursalId: 3,
        visibleSucursalIds: [1, 2],
      }),
      [SOCKET_ROOMS.install, "user:7", "branch:3"],
    );
  });

  await t.test("una sucursal inválida no crea sala", () => {
    for (const value of [0, -1, Number.NaN, 1.5]) {
      assert.deepEqual(
        resolveSocketRooms({ userId: 1, activeSucursalId: value as number }),
        [SOCKET_ROOMS.install, "user:1"],
      );
    }
  });
});

test("el destino del evento es el mínimo necesario", async (t) => {
  await t.test("aviso de sucursal va sólo a esa sucursal", () => {
    assert.equal(
      resolveNotificationRoom({ sucursalId: 3, userId: 7 }),
      "branch:3",
    );
  });

  await t.test("aviso personal va sólo a ese usuario", () => {
    assert.equal(resolveNotificationRoom({ userId: 7 }), "user:7");
  });

  await t.test("aviso del programa va a la instalación", () => {
    assert.equal(resolveNotificationRoom({}), SOCKET_ROOMS.install);
    assert.equal(
      resolveNotificationRoom({ sucursalId: 0, userId: null }),
      SOCKET_ROOMS.install,
    );
  });

  await t.test("un id inválido no se usa como sala", () => {
    assert.equal(
      resolveNotificationRoom({ sucursalId: -2, userId: 0 }),
      SOCKET_ROOMS.install,
    );
  });
});
