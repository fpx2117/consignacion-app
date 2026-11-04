// Test de wiring de auditoría.
//
// Por qué existe: las mutaciones cubiertas llaman a `recordAuditLog` después de
// escribir, y ese efecto es difícil de ejercitar en unitarios porque requiere
// Prisma. Lo que sí se puede garantizar sin base es que la llamada siga ahí: si
// alguien refactoriza un handler y se lleva puesta la auditoría, este test falla.
//
// Mismo enfoque que `venta-numbering-wiring.test.ts`: se inspecciona el fuente.
// No valida la forma del payload (eso lo cubre `audit-events.test.ts`), valida
// que el handler siga auditando.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type CoveredHandler = {
  file: string;
  builders: string[];
};

const COVERED: CoveredHandler[] = [
  { file: "src/app/api/settings/users/handlers.ts", builders: ["userCreated", "userUpdated", "userDeleted"] },
  { file: "src/app/api/productos/route.ts", builders: ["productCreated"] },
  { file: "src/app/api/productos/[id]/route.ts", builders: ["productUpdated", "productDeactivated"] },
  { file: "src/app/api/ventas/[id]/route.ts", builders: ["saleCancelled"] },
  { file: "src/app/api/consignaciones/route.ts", builders: ["consignmentCreated"] },
  { file: "src/app/api/settings/general/route.ts", builders: ["settingsUpdated"] },
];

test("cada mutación cubierta sigue llamando a recordAuditLog", () => {
  const missing: string[] = [];

  for (const { file, builders } of COVERED) {
    const source = readFileSync(file, "utf8");

    // `recordAuditLog(...)` directo o inyectado por deps: ambos sirven.
    if (!/\brecordAuditLog\s*\(/.test(source)) {
      missing.push(`${file}: no llama a recordAuditLog`);
    }

    for (const builder of builders) {
      if (!new RegExp(`\\b${builder}\\s*\\(`).test(source)) {
        missing.push(`${file}: no usa el builder ${builder}`);
      }
    }
  }

  assert.deepEqual(missing, []);
});

test("los eventos de auditoría nunca escriben credenciales", () => {
  // Busca asignaciones a claves sensibles dentro del payload del evento, por
  // ejemplo `password: plaintext` o `token: auth.token`. No matchea
  // `passwordChanged: true`, que es un booleano y no una credencial.
  const sensitiveKey = /\b(password|hash|token|secret|apiKey|accessToken)\s*:/i;
  const offenders: string[] = [];

  for (const { file } of COVERED) {
    const source = readFileSync(file, "utf8");
    const calls = source.match(/recordAuditLog\s*\([\s\S]*?\)\s*;/g) ?? [];

    for (const call of calls) {
      if (sensitiveKey.test(call)) offenders.push(`${file}: ${call.slice(0, 80)}`);
    }
  }

  assert.deepEqual(offenders, []);
});
