import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOpaqueUploadFilename,
  resolveServableUploadResource,
  validateUploadCandidate,
} from "@/lib/uploads";

const PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
]);

test("validateUploadCandidate acepta PNG valido para product-image", () => {
  const result = validateUploadCandidate({
    buffer: PNG_BUFFER,
    declaredMimeType: "image/png",
    originalFilename: "producto.png",
    size: PNG_BUFFER.length,
    useCase: "product-image",
  });

  assert.deepEqual(result, {
    ok: true,
    contentType: "image/png",
    normalizedExtension: "png",
  });
});

test("validateUploadCandidate rechaza archivo disfrazado por firma invalida", () => {
  const payload = Buffer.from("<script>alert('xss')</script>", "utf8");
  const result = validateUploadCandidate({
    buffer: payload,
    declaredMimeType: "image/png",
    originalFilename: "producto.png",
    size: payload.length,
    useCase: "product-image",
  });

  assert.deepEqual(result, {
    ok: false,
    error: "El contenido del archivo no coincide con el tipo declarado",
    status: 415,
  });
});

test("validateUploadCandidate rechaza payload no permitido por extension y MIME", () => {
  const svgPayload = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf8");
  const result = validateUploadCandidate({
    buffer: svgPayload,
    declaredMimeType: "image/svg+xml",
    originalFilename: "payload.svg",
    size: svgPayload.length,
    useCase: "product-image",
  });

  assert.deepEqual(result, {
    ok: false,
    error: "El tipo de archivo no esta permitido",
    status: 415,
  });
});

test("validateUploadCandidate rechaza archivos que exceden el tamano maximo", () => {
  const result = validateUploadCandidate({
    buffer: PNG_BUFFER,
    declaredMimeType: "image/png",
    originalFilename: "producto.png",
    size: 5 * 1024 * 1024 + 1,
    useCase: "product-image",
  });

  assert.deepEqual(result, {
    ok: false,
    error: "El archivo supera el limite permitido de 5MB",
    status: 413,
  });
});

test("buildOpaqueUploadFilename desacopla el nombre publico del original", () => {
  const filename = buildOpaqueUploadFilename("png");

  assert.match(filename, /^[0-9a-f-]+\.png$/i);
  assert.equal(filename.includes("producto"), false);
});

test("resolveServableUploadResource rechaza rutas ambiguas y traversal", () => {
  assert.deepEqual(resolveServableUploadResource(["..", "secret.txt"]), { ok: false });
  assert.deepEqual(resolveServableUploadResource(["nested/file.png"]), { ok: false });
  assert.deepEqual(resolveServableUploadResource(["legacy-name.png"]), { ok: false });
});
