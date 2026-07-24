import { NextResponse } from "next/server";
import { performanceVitalsStore } from "@/lib/performance-vitals-store";

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const minutes = Number(searchParams.get("minutes") || "60");
  const urlPrefix = searchParams.get("url") || undefined;

  const windowMinutes =
    Number.isFinite(minutes) && minutes > 0 ? Math.min(minutes, 24 * 60) : 60;
  const summary = performanceVitalsStore.summary(windowMinutes, urlPrefix);

  return NextResponse.json(
    {
      ok: true,
      ...summary,
    },
    { headers: noStoreHeaders() },
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const sample = {
      id: String(body?.id || crypto.randomUUID()),
      name: String(body?.name || "") as "CLS" | "FCP" | "INP" | "LCP" | "TTFB",
      value: Number(body?.value || 0),
      rating: String(body?.rating || "unknown"),
      delta: Number(body?.delta || 0),
      navigationType: body?.navigationType
        ? String(body.navigationType)
        : undefined,
      url: String(body?.url || "unknown"),
      ts: Number(body?.ts || Date.now()),
    };

    if (!["CLS", "FCP", "INP", "LCP", "TTFB"].includes(sample.name)) {
      return NextResponse.json(
        { ok: false, error: "invalid_metric" },
        { status: 400, headers: noStoreHeaders() },
      );
    }

    if (!Number.isFinite(sample.value) || sample.value < 0) {
      return NextResponse.json(
        { ok: false, error: "invalid_value" },
        { status: 400, headers: noStoreHeaders() },
      );
    }

    performanceVitalsStore.add(sample);

    // Logging liviano en server (sin persistencia por ahora)
    if (process.env.NODE_ENV !== "production") {
      console.info("[web-vitals]", {
        name: sample.name,
        value: sample.value,
        rating: sample.rating,
        url: sample.url,
      });
    }

    return NextResponse.json(
      { ok: true },
      { status: 202, headers: noStoreHeaders() },
    );
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 400, headers: noStoreHeaders() },
    );
  }
}
