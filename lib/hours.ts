/** 지금 문을 열었는가.
 *
 * 이 앱의 전부다. 나머지는 이 판정을 지도에 올리는 일일 뿐이다.
 *
 * 두 가지를 조심한다.
 *
 * 1. **공휴일은 요일이 아니다.** 2026년 추석은 목요일인데, 목요일 운영시간을
 *    적용하면 닫힌 약국을 열었다고 말하게 된다. 공휴일이면 8번 칸만 본다.
 * 2. **"모름"은 "닫힘"이 아니다.** 다만 운영시간을 한 칸이라도 신고한 약국이
 *    특정 요일을 비워 뒀다면 그건 그날 쉰다는 뜻으로 읽는다. 아무 칸도 없는
 *    약국(전체의 0.3%)만 진짜 '모름'이다.
 */
import type { OpenStatus, Pharmacy } from './types';

const KST_OFFSET_MINUTES = 9 * 60;
const MINUTES_PER_DAY = 24 * 60;

/** "0900" → 540. 읽을 수 없으면 null — 0으로 떨어뜨리면 자정 영업이 된다. */
export function parseHHMM(raw: string): number | null {
  if (!/^\d{4}$/.test(raw)) return null;

  const hour = Number(raw.slice(0, 2));
  const minute = Number(raw.slice(2));

  // 2400 은 포털이 "자정까지"를 적는 방식이라 허용한다.
  if (hour === 24 && minute === 0) return MINUTES_PER_DAY;
  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
}

/** 어떤 타임존에서 돌든 KST 기준으로 본다. Vercel 은 UTC 다. */
function kstParts(at: Date): { ymd: string; weekday: number; minutes: number } {
  const shifted = new Date(at.getTime() + KST_OFFSET_MINUTES * 60_000);

  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');

  return {
    ymd: `${year}${month}${day}`,
    // getUTCDay: 0=일요일. 월요일이 0 이 되도록 옮긴다.
    weekday: (shifted.getUTCDay() + 6) % 7,
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** KST 자정으로부터 몇 분. */
export function minutesOf(at: Date): number {
  return kstParts(at).minutes;
}

export function isHoliday(at: Date, holidays: ReadonlySet<string>): boolean {
  return holidays.has(kstParts(at).ymd);
}

/** 0=월 … 6=일, 7=공휴일. 공휴일이 요일을 이긴다. */
export function dayIndex(at: Date, holidays: ReadonlySet<string>): number {
  const { ymd, weekday } = kstParts(at);
  return holidays.has(ymd) ? 7 : weekday;
}

function within(minutes: number, [open, close]: readonly [number, number]): boolean {
  // 종료가 시작보다 이르면 자정을 넘긴 영업이다 (09:00~01:00).
  return close < open ? minutes >= open || minutes < close : minutes >= open && minutes < close;
}

export function openStatus(
  hours: Pharmacy['h'],
  at: Date,
  holidays: ReadonlySet<string>,
): OpenStatus {
  if (hours.every((slot) => slot === null)) return 'unknown';

  const today = hours[dayIndex(at, holidays)];
  if (today && within(minutesOf(at), today)) return 'open';

  // 자정을 넘겨 영업 중인 어제 시간대에 아직 걸쳐 있을 수 있다.
  const yesterday = hours[(dayIndex(at, holidays) + 6) % 7];
  if (yesterday && yesterday[1] < yesterday[0] && minutesOf(at) < yesterday[1]) return 'open';

  return 'closed';
}
