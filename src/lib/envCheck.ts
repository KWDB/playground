import { type EnvCheckItem } from '@/components/business/envCheckItems';

export type EnvCheckSummary = {
  ok: boolean;
  items: EnvCheckItem[];
};

const CACHE_TTL_MS = 15000;

let cachedSummary: EnvCheckSummary | null = null;
let cachedAt = 0;
let inFlight: Promise<EnvCheckSummary> | null = null;

async function fetchEnvCheckSummary(): Promise<EnvCheckSummary> {
  let resp = await fetch('/api/env-check');
  if (!resp.ok) {
    resp = await fetch('/api/doctor');
  }
  if (!resp.ok) {
    throw new Error('环境检测接口返回错误');
  }
  return resp.json();
}

export function invalidateEnvCheckSummaryCache() {
  cachedSummary = null;
  cachedAt = 0;
}

export async function getEnvCheckSummary(force = false): Promise<EnvCheckSummary> {
  const now = Date.now();
  if (!force && cachedSummary && now - cachedAt < CACHE_TTL_MS) {
    return cachedSummary;
  }
  if (inFlight) {
    return inFlight;
  }

  inFlight = fetchEnvCheckSummary()
    .then(summary => {
      cachedSummary = summary;
      cachedAt = Date.now();
      return summary;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
