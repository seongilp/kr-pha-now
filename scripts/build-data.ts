/**
 * 전국 약국과 공휴일을 받아 `public/data/` 에 구워 둔다.
 *
 * 런타임에 data.go.kr 을 치지 않는 이유: 약국 운영시간은 분 단위로 바뀌는 값이
 * 아니고(월 단위로도 거의 안 바뀐다), 25,415건을 매 요청마다 25페이지씩 끌어오면
 * 느린 데다 포털에 폐가 된다. 대신 배포할 때 한 번 굽고 정적으로 낸다.
 *
 *   npm run data
 *
 * 키는 DATA_GO_KR_KEY. **Encoding 형태**(%2B, %2F 가 이미 든 쪽)를 그대로 넣어야
 * 한다. 재인코딩하면 SERVICE_KEY_IS_NOT_REGISTERED_ERROR(code 30) 가 나는데,
 * 이건 "미신청"과 같은 코드라 원인을 헷갈리게 만든다.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { cellKey } from '../lib/geo.ts';
import { parseHHMM } from '../lib/hours.ts';
import type { Pharmacy } from '../lib/types.ts';

const PHARMACY_BASE = 'https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService';
const HOLIDAY_BASE = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService';
const OUT_DIR = path.join(import.meta.dirname, '..', 'public', 'data');
const PAGE_SIZE = 1000;
/** 좌표가 이 범위를 벗어나면 한국이 아니다. 지금은 0건이지만 조용히 새는 걸 막는다. */
const KOREA = { minLat: 33.0, maxLat: 38.7, minLon: 124.5, maxLon: 132.0 };

function requireKey(): string {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) throw new Error('DATA_GO_KR_KEY 가 없습니다. .env.local 을 확인하세요.');
  return key;
}

async function fetchXml(url: string): Promise<string> {
  const response = await fetch(url, { headers: { Accept: 'application/xml' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} — ${url.split('?')[0]}`);

  const body = await response.text();
  const error = /<errMsg>([^<]*)<\/errMsg>/.exec(body);
  if (error) {
    const reason = /<returnAuthMsg>([^<]*)<\/returnAuthMsg>/.exec(body)?.[1] ?? '';
    throw new Error(`${error[1]} ${reason}`.trim());
  }

  return body;
}

/** 태그 파서. 응답이 평평한 <item> 목록이라 XML 라이브러리를 들일 값어치가 없다. */
function items(xml: string): Record<string, string>[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => {
    const fields: Record<string, string> = {};
    for (const [, tag, value] of match[1].matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) {
      fields[tag] = value.trim();
    }
    return fields;
  });
}

function totalCount(xml: string): number {
  return Number(/<totalCount>(\d+)<\/totalCount>/.exec(xml)?.[1] ?? 0);
}

function toPharmacy(row: Record<string, string>): Pharmacy | null {
  const lat = Number(row.wgs84Lat);
  const lon = Number(row.wgs84Lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < KOREA.minLat || lat > KOREA.maxLat) return null;
  if (lon < KOREA.minLon || lon > KOREA.maxLon) return null;

  // dutyTime1..8 = 월화수목금토일공휴일. 값이 빈 칸은 XML 에서 통째로 빠진다.
  const hours = Array.from({ length: 8 }, (_, day) => {
    const open = parseHHMM(row[`dutyTime${day + 1}s`] ?? '');
    const close = parseHHMM(row[`dutyTime${day + 1}c`] ?? '');
    return open === null || close === null ? null : ([open, close] as const);
  });

  return {
    i: row.hpid ?? '',
    n: row.dutyName ?? '',
    a: row.dutyAddr ?? '',
    t: row.dutyTel1 ?? '',
    y: Number(lat.toFixed(6)),
    x: Number(lon.toFixed(6)),
    h: hours,
  };
}

async function fetchPharmacies(key: string): Promise<Pharmacy[]> {
  const url = (page: number) =>
    `${PHARMACY_BASE}/getParmacyFullDown?serviceKey=${key}&pageNo=${page}&numOfRows=${PAGE_SIZE}`;

  const first = await fetchXml(url(1));
  const total = totalCount(first);
  const pages = Math.ceil(total / PAGE_SIZE);
  console.log(`약국 ${total.toLocaleString()}건, ${pages}페이지`);

  const rows = items(first);
  for (let page = 2; page <= pages; page += 1) {
    rows.push(...items(await fetchXml(url(page))));
    process.stdout.write(`\r  ${page}/${pages}`);
  }
  process.stdout.write('\n');

  const parsed = rows.map(toPharmacy).filter((x): x is Pharmacy => x !== null);
  const dropped = rows.length - parsed.length;
  if (dropped) console.warn(`  좌표가 이상해 버린 항목 ${dropped}건`);

  return parsed;
}

/** 올해와 내년. 12월에 배포해도 다음 달 공휴일이 비지 않게. */
async function fetchHolidays(key: string): Promise<string[]> {
  const years = [new Date().getFullYear(), new Date().getFullYear() + 1];
  const dates: string[] = [];

  for (const year of years) {
    const xml = await fetchXml(
      `${HOLIDAY_BASE}/getRestDeInfo?serviceKey=${key}&solYear=${year}&numOfRows=100`,
    );
    for (const row of items(xml)) {
      if (row.isHoliday === 'Y' && row.locdate) dates.push(row.locdate);
    }
  }

  return [...new Set(dates)].sort();
}

async function main(): Promise<void> {
  const key = requireKey();

  const [pharmacies, holidays] = await Promise.all([fetchPharmacies(key), fetchHolidays(key)]);
  console.log(`공휴일 ${holidays.length}일 (${holidays[0]} ~ ${holidays.at(-1)})`);

  const tiles = new Map<string, Pharmacy[]>();
  for (const pharmacy of pharmacies) {
    const key = cellKey(pharmacy.y, pharmacy.x);
    const bucket = tiles.get(key);
    if (bucket) bucket.push(pharmacy);
    else tiles.set(key, [pharmacy]);
  }

  await mkdir(path.join(OUT_DIR, 'tiles'), { recursive: true });

  let bytes = 0;
  for (const [key, bucket] of tiles) {
    const json = JSON.stringify(bucket);
    bytes += json.length;
    await writeFile(path.join(OUT_DIR, 'tiles', `${key}.json`), json, 'utf8');
  }

  await writeFile(
    path.join(OUT_DIR, 'index.json'),
    JSON.stringify({
      builtAt: new Date().toISOString(),
      count: pharmacies.length,
      holidays,
      tiles: Object.fromEntries([...tiles].map(([key, bucket]) => [key, bucket.length])),
    }),
    'utf8',
  );

  const largest = [...tiles].sort((a, b) => b[1].length - a[1].length)[0];
  console.log(
    `타일 ${tiles.size}개, 합계 ${(bytes / 1024 / 1024).toFixed(1)}MB, ` +
      `최대 ${largest[0]} (${largest[1].length.toLocaleString()}건)`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
