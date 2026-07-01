import path from "path";
import { randomUUID } from "crypto";
import { existsSync } from "fs";

export type UploadUseCase = "product-image" | "factura-proveedor";

type AllowedUploadType = {
  canonicalExtension: "jpg" | "png" | "webp" | "gif" | "pdf";
  extensions: readonly string[];
  mimeTypes: readonly string[];
  sniff: (buffer: Buffer) => boolean;
};

type UploadPolicy = {
  maxBytes: number;
  allowedTypes: readonly AllowedUploadType[];
};

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const GIF87A_SIGNATURE = Buffer.from("GIF87a", "ascii");
const GIF89A_SIGNATURE = Buffer.from("GIF89a", "ascii");
const WEBP_RIFF_SIGNATURE = Buffer.from("RIFF", "ascii");
const WEBP_SIGNATURE = Buffer.from("WEBP", "ascii");

const PRODUCT_IMAGE_ALLOWED_TYPES = [
  {
    canonicalExtension: "jpg",
    extensions: ["jpg", "jpeg"],
    mimeTypes: ["image/jpeg", "image/pjpeg"],
    sniff: (buffer: Buffer) => hasPrefix(buffer, JPEG_SIGNATURE),
  },
  {
    canonicalExtension: "png",
    extensions: ["png"],
    mimeTypes: ["image/png"],
    sniff: (buffer: Buffer) => hasPrefix(buffer, PNG_SIGNATURE),
  },
  {
    canonicalExtension: "webp",
    extensions: ["webp"],
    mimeTypes: ["image/webp"],
    sniff: (buffer: Buffer) =>
      buffer.length >= 12
      && buffer.subarray(0, 4).equals(WEBP_RIFF_SIGNATURE)
      && buffer.subarray(8, 12).equals(WEBP_SIGNATURE),
  },
  {
    canonicalExtension: "gif",
    extensions: ["gif"],
    mimeTypes: ["image/gif"],
    sniff: (buffer: Buffer) =>
      buffer.length >= 6
      && (buffer.subarray(0, 6).equals(GIF87A_SIGNATURE)
        || buffer.subarray(0, 6).equals(GIF89A_SIGNATURE)),
  },
] satisfies readonly AllowedUploadType[];

const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");

const FACTURA_PROVEEDOR_ALLOWED_TYPES = [
  PRODUCT_IMAGE_ALLOWED_TYPES[0], // jpg
  PRODUCT_IMAGE_ALLOWED_TYPES[1], // png
  PRODUCT_IMAGE_ALLOWED_TYPES[2], // webp
  {
    canonicalExtension: "pdf",
    extensions: ["pdf"],
    mimeTypes: ["application/pdf"],
    sniff: (buffer: Buffer) => hasPrefix(buffer, Array.from(PDF_SIGNATURE)),
  },
] satisfies readonly AllowedUploadType[];

const UPLOAD_POLICIES: Record<UploadUseCase, UploadPolicy> = {
  "product-image": {
    maxBytes: 5 * 1024 * 1024,
    allowedTypes: PRODUCT_IMAGE_ALLOWED_TYPES,
  },
  "factura-proveedor": {
    maxBytes: 15 * 1024 * 1024,
    allowedTypes: FACTURA_PROVEEDOR_ALLOWED_TYPES,
  },
};

const SERVABLE_EXTENSIONS = new Set(
  PRODUCT_IMAGE_ALLOWED_TYPES.flatMap((entry) => entry.extensions),
);

// Las facturas de proveedor NUNCA se sirven por /api/files (documentos de negocio
// sensibles): se guardan en un subdirectorio propio y sólo se leen server-side
// (confirmación OCR, futuro envío a Modal por URL firmada de corta duración).
//
// A diferencia de getUploadStorageDir(), NO cae en fallback a public/uploads:
// ese directorio lo sirve Next.js estáticamente, y una factura ahí quedaría
// accesible sin autenticación para quien adivine el nombre de archivo.
export function getFacturaProveedorStorageDir(): string {
  if (process.env.UPLOAD_DIR) {
    return path.join(path.resolve(process.env.UPLOAD_DIR), "facturas-proveedor");
  }
  return path.join(process.cwd(), "storage", "facturas-proveedor");
}

const OPAQUE_UPLOAD_FILENAME_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|gif)$/i;
const LEGACY_API_UPLOAD_FILENAME_REGEX = /^\d{13}-[a-z0-9][a-z0-9._-]{0,180}\.(jpg|jpeg|png|webp|gif)$/i;

export type UploadValidationSuccess = {
  ok: true;
  contentType: string;
  normalizedExtension: string;
};

export type UploadValidationFailure = {
  ok: false;
  error: string;
  status: 400 | 413 | 415;
};

export type UploadValidationResult = UploadValidationSuccess | UploadValidationFailure;

export type ServableUploadResource = {
  ok: true;
  contentType: string;
  filename: string;
};

export type RejectedUploadResource = {
  ok: false;
};

export function resolveUploadFilesystemCandidates(filename: string): string[] {
  const primaryDir = getUploadStorageDir();
  const candidates = [path.join(primaryDir, filename)];

  if (isLegacyApiUploadFilename(filename)) {
    const legacyDir = getLegacyPublicUploadDir();
    if (legacyDir !== primaryDir) {
      candidates.push(path.join(legacyDir, filename));
    }
  }

  return candidates;
}

export function getUploadPolicy(useCase: UploadUseCase): UploadPolicy {
  return UPLOAD_POLICIES[useCase];
}

export function getUploadStorageDir(): string {
  if (process.env.UPLOAD_DIR) {
    return path.resolve(process.env.UPLOAD_DIR);
  }

  const storageDir = path.join(process.cwd(), "storage", "uploads");
  if (existsSync(storageDir)) {
    return storageDir;
  }

  return getLegacyPublicUploadDir();
}

export function getLegacyPublicUploadDir(): string {
  return path.join(process.cwd(), "public", "uploads");
}

export function buildOpaqueUploadFilename(normalizedExtension: string): string {
  return `${randomUUID()}.${normalizedExtension}`;
}

export function isOpaqueUploadFilename(filename: string): boolean {
  return OPAQUE_UPLOAD_FILENAME_REGEX.test(filename);
}

export function isLegacyApiUploadFilename(filename: string): boolean {
  return LEGACY_API_UPLOAD_FILENAME_REGEX.test(filename);
}

export function getUploadUrl(filename: string): string {
  return `/api/files/${filename}`;
}

export function resolveServableUploadResource(segments: string[]): ServableUploadResource | RejectedUploadResource {
  if (segments.length !== 1) {
    return { ok: false };
  }

  const candidate = segments[0]?.trim();
  if (!candidate || (!isOpaqueUploadFilename(candidate) && !isLegacyApiUploadFilename(candidate))) {
    return { ok: false };
  }

  const extension = candidate.split(".").pop()?.toLowerCase();
  if (!extension || !SERVABLE_EXTENSIONS.has(extension)) {
    return { ok: false };
  }

  const contentType = getContentTypeForExtension(extension);
  if (!contentType) {
    return { ok: false };
  }

  return {
    ok: true,
    filename: candidate,
    contentType,
  };
}

export function validateUploadCandidate(input: {
  buffer: Buffer;
  declaredMimeType: string;
  originalFilename: string;
  size: number;
  useCase: UploadUseCase;
}): UploadValidationResult {
  const { buffer, declaredMimeType, originalFilename, size, useCase } = input;
  const policy = getUploadPolicy(useCase);

  if (!Number.isFinite(size) || size <= 0) {
    return {
      ok: false,
      error: "El archivo esta vacio o es invalido",
      status: 400,
    };
  }

  if (size > policy.maxBytes) {
    return {
      ok: false,
      error: `El archivo supera el limite permitido de ${Math.floor(policy.maxBytes / (1024 * 1024))}MB`,
      status: 413,
    };
  }

  const extension = getNormalizedExtension(originalFilename);
  if (!extension) {
    return {
      ok: false,
      error: "El archivo no tiene una extension permitida",
      status: 415,
    };
  }

  const allowedType = policy.allowedTypes.find((entry) => entry.extensions.includes(extension));
  if (!allowedType) {
    return {
      ok: false,
      error: "El tipo de archivo no esta permitido",
      status: 415,
    };
  }

  const normalizedMimeType = declaredMimeType.trim().toLowerCase();
  if (!normalizedMimeType || !allowedType.mimeTypes.includes(normalizedMimeType)) {
    return {
      ok: false,
      error: "El MIME declarado no coincide con una politica permitida",
      status: 415,
    };
  }

  if (!allowedType.sniff(buffer)) {
    return {
      ok: false,
      error: "El contenido del archivo no coincide con el tipo declarado",
      status: 415,
    };
  }

  return {
    ok: true,
    normalizedExtension: allowedType.canonicalExtension,
    contentType: getContentTypeForExtension(allowedType.canonicalExtension)!,
  };
}

export function resolveStoredUploadPathFromUrl(url: string): string | null {
  if (!url) {
    return null;
  }

  if (url.startsWith("/api/files/")) {
    const filename = url.slice("/api/files/".length);
    if (!isOpaqueUploadFilename(filename) && !isLegacyApiUploadFilename(filename)) {
      return null;
    }

    const candidates = resolveUploadFilesystemCandidates(filename);
    return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0] ?? null;
  }

  if (url.startsWith("/uploads/")) {
    const filename = url.slice("/uploads/".length);
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(filename) || filename.includes("/") || filename.includes("\\")) {
      return null;
    }

    return path.join(getLegacyPublicUploadDir(), filename);
  }

  return null;
}

function getNormalizedExtension(originalFilename: string): string | null {
  const rawExtension = path.extname(originalFilename).replace(/^\./, "").toLowerCase();
  return rawExtension || null;
}

function getContentTypeForExtension(extension: string): string | null {
  switch (extension.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "pdf":
      return "application/pdf";
    default:
      return null;
  }
}

function hasPrefix(buffer: Buffer, signature: readonly number[]): boolean {
  if (buffer.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => buffer[index] === byte);
}
