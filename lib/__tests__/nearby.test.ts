import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { rank } from '../nearby.ts';
import type { Pharmacy } from '../types.ts';

const HOLIDAYS = new Set<string>();
const MONDAY_10AM = new Date('2026-09-21T10:00:00+09:00');

function make(id: string, lat: number, lon: number, hours?: Pharmacy['h']): Pharmacy {
  return {
    i: id, n: `${id}약국`, a: '주소', t: '051-000-0000', y: lat, x: lon,
    h: hours ?? [[540, 1140], [540, 1140], [540, 1140], [540, 1140], [540, 1140], null, null, null],
  };
}

const ORIGIN = { lat: 37.5665, lon: 126.978 };

describe('rank', () => {
  it('sorts by distance from the origin', () => {
    const far = make('far', 37.60, 126.978);
    const near = make('near', 37.57, 126.978);
    const result = rank([far, near], ORIGIN, MONDAY_10AM, HOLIDAYS, { openOnly: false });

    assert.deepEqual(result.map((r) => r.pharmacy.i), ['near', 'far']);
  });

  it('attaches distance and status', () => {
    const [first] = rank([make('a', 37.57, 126.978)], ORIGIN, MONDAY_10AM, HOLIDAYS, { openOnly: false });

    assert.equal(first.status, 'open');
    assert.ok(first.meters > 0 && first.meters < 5000);
  });

  it('drops closed ones when openOnly is set', () => {
    const closed = make('closed', 37.57, 126.978, [null, null, null, null, null, [540, 780], null, null]);
    const open = make('open', 37.58, 126.978);
    const result = rank([closed, open], ORIGIN, MONDAY_10AM, HOLIDAYS, { openOnly: true });

    assert.deepEqual(result.map((r) => r.pharmacy.i), ['open']);
  });

  it('keeps unknown ones under openOnly, because unknown is not closed', () => {
    const blank: Pharmacy['h'] = [null, null, null, null, null, null, null, null];
    const unknown = make('unknown', 37.57, 126.978, blank);
    const result = rank([unknown], ORIGIN, MONDAY_10AM, HOLIDAYS, { openOnly: true });

    assert.deepEqual(result.map((r) => r.status), ['unknown']);
  });

  it('drops anything past the radius', () => {
    const busan = make('busan', 35.1796, 129.0756);
    const result = rank([busan], ORIGIN, MONDAY_10AM, HOLIDAYS, { openOnly: false, radiusMeters: 5000 });

    assert.deepEqual(result, []);
  });

  it('caps the result count', () => {
    const many = Array.from({ length: 300 }, (_, n) => make(`p${n}`, 37.5665 + n * 0.0001, 126.978));
    const result = rank(many, ORIGIN, MONDAY_10AM, HOLIDAYS, { openOnly: false, limit: 50 });

    assert.equal(result.length, 50);
  });

  it('returns an empty list for no input rather than throwing', () => {
    assert.deepEqual(rank([], ORIGIN, MONDAY_10AM, HOLIDAYS, { openOnly: true }), []);
  });
});
