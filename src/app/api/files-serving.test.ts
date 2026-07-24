import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import test from "node:test";
import { handleGetFile } from "@/app/api/files/[...path]/route";
import { buildOpaqueUploadFilename } from "@/lib/uploads/uploads";

const PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

test("handleGetFile sirve archivos permitidos con headers defensivos", async () => {
  const uploadDir = await mkdtemp(path.join(tmpdir(), "consignacion-files-"));
  const filename = buildOpaqueUploadFilename("png");
  await writeFile(path.join(uploadDir, filename), PNG_BUFFER);

  const response = await handleGetFile(
    new Request(`http://localhost/api/files/${filename}`),
    { path: [filename] },
    { lstat, readFile, uploadDir },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/png");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.match(response.headers.get("Content-Disposition") ?? "", /^inline;/);
  assert.equal(
    Buffer.from(await response.arrayBuffer()).equals(PNG_BUFFER),
    true,
  );
});

test("handleGetFile rechaza rutas ambiguas antes de tocar el filesystem", async () => {
  const uploadDir = await mkdtemp(path.join(tmpdir(), "consignacion-files-"));

  const response = await handleGetFile(
    new Request("http://localhost/api/files/../secreto.txt"),
    { path: ["..", "secreto.txt"] },
    { lstat, readFile, uploadDir },
  );

  assert.equal(response.status, 404);
});

test("handleGetFile rechaza tipos existentes fuera de la allowlist servible", async () => {
  const uploadDir = await mkdtemp(path.join(tmpdir(), "consignacion-files-"));
  const filename = `${buildOpaqueUploadFilename("png").replace(/\.png$/i, "")}.svg`;
  await writeFile(
    path.join(uploadDir, filename),
    Buffer.from("<svg></svg>", "utf8"),
  );

  const response = await handleGetFile(
    new Request(`http://localhost/api/files/${filename}`),
    { path: [filename] },
    { lstat, readFile, uploadDir },
  );

  assert.equal(response.status, 404);
});

test("handleGetFile mantiene compatibilidad transitoria para nombres legacy de api/files", async () => {
  const uploadDir = await mkdtemp(path.join(tmpdir(), "consignacion-files-"));
  const filename = "1772837979983-e6c14d0f_3d7a_4f25_8712_a5468b554bc5.png";
  await writeFile(path.join(uploadDir, filename), PNG_BUFFER);

  const response = await handleGetFile(
    new Request(`http://localhost/api/files/${filename}`),
    { path: [filename] },
    { lstat, readFile, uploadDir },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/png");
  assert.equal(
    Buffer.from(await response.arrayBuffer()).equals(PNG_BUFFER),
    true,
  );
});
