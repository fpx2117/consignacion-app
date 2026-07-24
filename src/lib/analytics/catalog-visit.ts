import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

const VISIT_BUCKET_MINUTES = 30;

function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    if (firstIp?.trim()) return firstIp.trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  return "unknown";
}

function getBucketStart(date = new Date()): Date {
  const bucketMs = VISIT_BUCKET_MINUTES * 60 * 1000;
  const time = Math.floor(date.getTime() / bucketMs) * bucketMs;
  return new Date(time);
}

function hashVisitor(
  sucursalId: number,
  ip: string,
  userAgent: string,
): string {
  const normalizedAgent = userAgent.toLowerCase().slice(0, 180);
  const raw = `${sucursalId}|${ip}|${normalizedAgent}`;
  return createHash("sha256").update(raw).digest("hex");
}

export async function registerCatalogVisit(params: {
  sucursalId: number;
  headers: Headers;
}): Promise<void> {
  const { sucursalId, headers } = params;
  const ip = getClientIp(headers);
  const userAgent = headers.get("user-agent") ?? "unknown";
  const visitorHash = hashVisitor(sucursalId, ip, userAgent);
  const bucketStart = getBucketStart();

  await prisma.catalogVisit.upsert({
    where: {
      sucursalId_visitorHash_bucketStart: {
        sucursalId,
        visitorHash,
        bucketStart,
      },
    },
    update: {
      visitedAt: new Date(),
    },
    create: {
      sucursalId,
      visitorHash,
      bucketStart,
      source: "public_lista",
    },
  });
}
