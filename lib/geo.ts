/** 좌표 계산과 타일 나누기.
 *
 * 전국 25,415곳을 한 파일로 내려보내면 15MB 다. 그래서 0.5° 격자로 잘라
 * 사용자가 선 자리 주변 9칸만 받는다. 격자는 행정구역이 아니라 좌표로 나눈다 —
 * 원본 주소의 시도 표기가 `서울특별시`/`서울`/`전남광주통합` 처럼 흔들리는 반면
 * 좌표는 25,415곳 전부 유효하기 때문이다.
 */
const CELL_DEGREES = 0.5;
const EARTH_RADIUS_M = 6_371_000;

export interface LatLon {
  lat: number;
  lon: number;
}

/** 하버사인. 수 km 규모에서 충분하고, 의존성을 늘릴 이유가 없다. */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function cellKey(lat: number, lon: number): string {
  return `${Math.floor(lat / CELL_DEGREES)}_${Math.floor(lon / CELL_DEGREES)}`;
}

/** 내가 선 칸과 그 둘레 8칸. 칸 경계에 서 있어도 옆 동네를 놓치지 않는다. */
export function cellsNear(lat: number, lon: number): string[] {
  const row = Math.floor(lat / CELL_DEGREES);
  const col = Math.floor(lon / CELL_DEGREES);
  const keys = [`${row}_${col}`];

  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      keys.push(`${row + dr}_${col + dc}`);
    }
  }

  return keys;
}

/** 사람이 읽는 거리. 미터 단위를 1m 까지 보여줘 봐야 정확해 보이지도 않는다. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}
