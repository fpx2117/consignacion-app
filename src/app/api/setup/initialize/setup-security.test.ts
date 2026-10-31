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

test("rechaza empleados con estructura o datos inválidos", () => {
  assert.match(
    validateSetupSecurity({ admin: validAdmin, staff: [null] as never }) ?? "",
    /empleados inválida/i,
  );
  assert.match(
    validateSetupSecurity({
      admin: validAdmin,
      staff: [
        { nombre: "", email: "not-an-email", password: 123 },
      ] as never,
    }) ?? "",
    /empleado inválido/i,
  );
});

test("rechaza colores de branding que permiten inyección CSS o HTML", () => {
  const message = validateSetupSecurity({
    admin: validAdmin,
    branding: { primaryColor: '\" onmouseover=\"alert(1)' },
  });
  assert.match(message ?? "", /color inválido/i);
});

test("rechaza contraseñas que bcrypt truncaría", () => {
  const message = validateSetupSecurity({
    admin: { ...validAdmin, password: `Aa1${"x".repeat(70)}` },
  });
  assert.match(message ?? "", /72 bytes/i);
});

test("rechaza payloads que no son objetos", () => {
  assert.match(validateSetupSecurity(null) ?? "", /payload inválido/i);
});

test("acepta un payload seguro", () => {
  const message = validateSetupSecurity({ admin: validAdmin, staff: [] });
  assert.equal(message, null);
});
