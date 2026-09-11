/** 내 주변에서, 지금 갈 수 있는 곳만 골라 가까운 순으로. */
import { distanceMeters, type LatLon } from './geo';
import { openStatus } from './hours';
import type { OpenStatus, Pharmacy } from './types';

export interface Ranked {
  pharmacy: Pharmacy;
  meters: number;
  status: OpenStatus;
}

export interface RankOptions {
  /** 문 연 곳만 볼 것인가. '모름'은 여기서도 남긴다 — 확인 못 한 것을 닫혔다고 할 수 없다. */
  openOnly: boolean;
  radiusMeters?: number;
  limit?: number;
}

const DEFAULT_RADIUS_METERS = 20_000;
const DEFAULT_LIMIT = 200;

export function rank(
  pharmacies: readonly Pharmacy[],
  origin: LatLon,
  at: Date,
  holidays: ReadonlySet<string>,
  options: RankOptions,
): Ranked[] {
  const radius = options.radiusMeters ?? DEFAULT_RADIUS_METERS;
  const limit = options.limit ?? DEFAULT_LIMIT;

  const ranked: Ranked[] = [];

  for (const pharmacy of pharmacies) {
    const meters = distanceMeters(origin, { lat: pharmacy.y, lon: pharmacy.x });
    if (meters > radius) continue;

    const status = openStatus(pharmacy.h, at, holidays);
    if (options.openOnly && status === 'closed') continue;

    ranked.push({ pharmacy, meters, status });
  }

  return ranked.sort((a, b) => a.meters - b.meters).slice(0, limit);
}
