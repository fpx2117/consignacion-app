"use client";

import { useReportWebVitals } from "next/web-vitals";

const SAMPLE_RATE = 0.2;

export function PerformanceVitals() {
  useReportWebVitals((metric) => {
    if (Math.random() > SAMPLE_RATE) return;

    const payload = {
      id: metric.id,
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      navigationType: metric.navigationType,
      url: typeof window !== "undefined" ? window.location.pathname : "",
      ts: Date.now(),
    };

    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/performance/vitals", body);
      return;
    }

    void fetch("/api/performance/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  });

  return null;
}
