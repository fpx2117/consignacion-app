type WebVitalName = "CLS" | "FCP" | "INP" | "LCP" | "TTFB";

export type WebVitalSample = {
  id: string;
  name: WebVitalName;
  value: number;
  rating: "good" | "needs-improvement" | "poor" | string;
  delta?: number;
  navigationType?: string;
  url: string;
  ts: number;
};

type GroupSummary = {
  metric: WebVitalName;
  url: string;
  count: number;
  avg: number;
  min: number;
  p50: number;
  p75: number;
  p95: number;
  max: number;
  ratings: {
    good: number;
    needsImprovement: number;
    poor: number;
    unknown: number;
  };
};

const MAX_SAMPLES = 5000;

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil((p / 100) * values.length) - 1),
  );
  return values[index];
}

function ratingBucket(rating: string) {
  if (rating === "good") return "good" as const;
  if (rating === "needs-improvement") return "needsImprovement" as const;
  if (rating === "poor") return "poor" as const;
  return "unknown" as const;
}

class PerformanceVitalsStore {
  private samples: WebVitalSample[] = [];

  add(sample: WebVitalSample) {
    this.samples.push(sample);
    if (this.samples.length > MAX_SAMPLES) {
      this.samples.splice(0, this.samples.length - MAX_SAMPLES);
    }
  }

  summary(lastMinutes = 60, urlPrefix?: string) {
    const cutoff = Date.now() - lastMinutes * 60_000;
    const filtered = this.samples.filter(
      (s) => s.ts >= cutoff && (!urlPrefix || s.url.startsWith(urlPrefix)),
    );

    const grouped = new Map<string, WebVitalSample[]>();

    for (const sample of filtered) {
      const key = `${sample.name}::${sample.url}`;
      const bucket = grouped.get(key);
      if (bucket) {
        bucket.push(sample);
      } else {
        grouped.set(key, [sample]);
      }
    }

    const entries: GroupSummary[] = [];

    for (const [key, group] of grouped.entries()) {
      const [metric, url] = key.split("::") as [WebVitalName, string];
      const values = group.map((g) => g.value).sort((a, b) => a - b);
      const ratings = {
        good: 0,
        needsImprovement: 0,
        poor: 0,
        unknown: 0,
      };

      for (const g of group) {
        ratings[ratingBucket(g.rating)] += 1;
      }

      const total = values.reduce((acc, v) => acc + v, 0);
      entries.push({
        metric,
        url,
        count: values.length,
        avg: total / values.length,
        min: values[0],
        p50: percentile(values, 50),
        p75: percentile(values, 75),
        p95: percentile(values, 95),
        max: values[values.length - 1],
        ratings,
      });
    }

    entries.sort((a, b) => {
      if (a.metric === b.metric) return b.count - a.count;
      return a.metric.localeCompare(b.metric);
    });

    return {
      windowMinutes: lastMinutes,
      totalSamples: filtered.length,
      groups: entries,
      generatedAt: new Date().toISOString(),
    };
  }
}

const globalStore = globalThis as unknown as {
  __performanceVitalsStore?: PerformanceVitalsStore;
};

export const performanceVitalsStore =
  globalStore.__performanceVitalsStore ??
  (globalStore.__performanceVitalsStore = new PerformanceVitalsStore());
