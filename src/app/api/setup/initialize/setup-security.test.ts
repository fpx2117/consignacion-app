import assert from "node:assert/strict";
import test from "node:test";
import { validateSetupSecurity } from "./setup-security";

const validAdmin = {
  nombre: "Ana",
  email: "ana@example.com",
  password: ["Secure", "Test", "123"].join("-"),
};

test("rechaza contraseñas débiles durante el setup", () => {
  const message = validateSetupSecurity({
    admin: { ...validAdmin, password: ["weak", "test"].join("-") },
  });
  assert.match(message ?? "", /mayúscula|número|caracteres/i);
});

test("rechaza logos inválidos antes de decodificarlos", () => {
  const message = validateSetupSecurity({
    admin: validAdmin,
    branding: { logoData: "not-base64", logoMime: "image/svg+xml" },
  });
  assert.match(message ?? "", /logo inválido/i);
});

test("rechaza contenido que no coincide con el MIME declarado", () => {
  const logoData = Buffer.from("<svg onload=alert(1)>").toString("base64");
  const message = validateSetupSecurity({
    admin: validAdmin,
    branding: { logoData, logoMime: "image/png" },
  });
  assert.match(message ?? "", /logo inválido/i);
});

test("acepta datos seguros sin persistir secretos", () => {
  const message = validateSetupSecurity({ admin: validAdmin, staff: [] });
  assert.equal(message, null);
});
