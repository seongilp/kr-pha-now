import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dayIndex, isHoliday, minutesOf, openStatus, parseHHMM } from '../hours.ts';
import type { Pharmacy } from '../types.ts';

const HOLIDAYS = new Set(['20260924', '20260925', '20260926']);

/** 월~금 09:00-19:00, 토 09:00-13:00, 일·공휴일 정보 없음. */
function weekdayOnly(): Pharmacy['h'] {
  return [
    [540, 1140], [540, 1140], [540, 1140], [540, 1140], [540, 1140],
    [540, 780],
    null,
    null,
  ];
}

describe('parseHHMM', () => {
  it('reads a four-digit clock', () => {
    assert.equal(parseHHMM('0900'), 540);
    assert.equal(parseHHMM('1930'), 1170);
  });

  it('treats 2400 as end of day', () => {
    assert.equal(parseHHMM('2400'), 1440);
  });

  it('rejects junk rather than guessing', () => {
    for (const raw of ['', '  ', '9', 'abc', '2530', '0899']) {
      assert.equal(parseHHMM(raw), null, `${raw} should not parse`);
    }
  });
});

describe('isHoliday', () => {
  it('matches a date in the set', () => {
    assert.equal(isHoliday(new Date('2026-09-24T10:00:00+09:00'), HOLIDAYS), true);
  });

  it('is false for an ordinary day', () => {
    assert.equal(isHoliday(new Date('2026-09-23T10:00:00+09:00'), HOLIDAYS), false);
  });
});

describe('dayIndex', () => {
  it('maps Monday to 0 and Sunday to 6', () => {
    assert.equal(dayIndex(new Date('2026-09-21T10:00:00+09:00'), new Set()), 0);
    assert.equal(dayIndex(new Date('2026-09-27T10:00:00+09:00'), new Set()), 6);
  });

  it('maps a holiday to 7 whatever the weekday', () => {
    // 2026-09-24 is a Thursday, but it is Chuseok.
    assert.equal(dayIndex(new Date('2026-09-24T10:00:00+09:00'), HOLIDAYS), 7);
  });
});

describe('openStatus', () => {
  const at = (iso: string) => new Date(iso);

  it('is open inside the window', () => {
    assert.equal(openStatus(weekdayOnly(), at('2026-09-21T10:00:00+09:00'), HOLIDAYS), 'open');
  });

  it('is closed before opening and after closing', () => {
    assert.equal(openStatus(weekdayOnly(), at('2026-09-21T08:59:00+09:00'), HOLIDAYS), 'closed');
    assert.equal(openStatus(weekdayOnly(), at('2026-09-21T19:01:00+09:00'), HOLIDAYS), 'closed');
  });

  it('is closed on a day the pharmacy left blank', () => {
    // Sunday is null, but the record is filled in for other days — that is a
    // reported schedule with Sunday omitted, which reads as closed.
    assert.equal(openStatus(weekdayOnly(), at('2026-09-27T10:00:00+09:00'), HOLIDAYS), 'closed');
  });

  it('is unknown when the record has no hours at all', () => {
    const nothing: Pharmacy['h'] = [null, null, null, null, null, null, null, null];
    assert.equal(openStatus(nothing, at('2026-09-21T10:00:00+09:00'), HOLIDAYS), 'unknown');
  });

  it('uses the holiday slot on a holiday, not the weekday slot', () => {
    const hours = weekdayOnly();
    hours[7] = [600, 780]; // 공휴일 10:00-13:00
    // Chuseok falls on a Thursday; the Thursday window (09:00-19:00) must not win.
    assert.equal(openStatus(hours, at('2026-09-24T09:30:00+09:00'), HOLIDAYS), 'closed');
    assert.equal(openStatus(hours, at('2026-09-24T11:00:00+09:00'), HOLIDAYS), 'open');
  });

  it('handles a window that runs past midnight', () => {
    const hours = weekdayOnly();
    hours[0] = [540, 60]; // 월 09:00 ~ 익일 01:00
    assert.equal(openStatus(hours, at('2026-09-21T23:30:00+09:00'), HOLIDAYS), 'open');
    assert.equal(openStatus(hours, at('2026-09-21T00:30:00+09:00'), HOLIDAYS), 'open');
    assert.equal(openStatus(hours, at('2026-09-21T02:00:00+09:00'), HOLIDAYS), 'closed');
  });

  it('reads the clock in KST regardless of the runtime timezone', () => {
    // 2026-09-21T01:00:00Z is 10:00 KST on Monday — open.
    assert.equal(openStatus(weekdayOnly(), at('2026-09-21T01:00:00Z'), HOLIDAYS), 'open');
  });
});

describe('minutesOf', () => {
  it('returns KST minutes past midnight', () => {
    assert.equal(minutesOf(new Date('2026-09-21T01:00:00Z')), 600);
  });
});
