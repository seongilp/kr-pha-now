/** 타일과 색인 읽기. 내가 선 자리 주변 9칸만, 한 번 받은 칸은 다시 안 받는다. */
import { cellsNear } from './geo';
import type { Pharmacy } from './types';

export interface DataIndex {
  builtAt: string;
  count: number;
  holidays: string[];
  tiles: Record<string, number>;
}

const cache = new Map<string, Promise<Pharmacy[]>>();

export async function loadIndex(): Promise<DataIndex> {
  const response = await fetch('/data/index.json');
  if (!response.ok) throw new Error(`색인을 불러오지 못했습니다 (HTTP ${response.status})`);
  return response.json();
}

function loadTile(key: string): Promise<Pharmacy[]> {
  const hit = cache.get(key);
  if (hit) return hit;

  const pending = fetch(`/data/tiles/${key}.json`)
    .then((response) => (response.ok ? response.json() : []))
    // 빈 칸(바다·국경 밖)은 파일 자체가 없다. 그건 오류가 아니라 약국이 없다는 뜻이다.
    .catch(() => [] as Pharmacy[]);

  cache.set(key, pending);
  return pending;
}

export async function loadNear(lat: number, lon: number, index: DataIndex): Promise<Pharmacy[]> {
  const keys = cellsNear(lat, lon).filter((key) => index.tiles[key]);
  const tiles = await Promise.all(keys.map(loadTile));
  return tiles.flat();
}
