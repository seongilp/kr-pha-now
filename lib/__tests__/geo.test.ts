import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cellKey, cellsNear, distanceMeters, formatDistance } from '../geo.ts';

const SEOUL = { lat: 37.5665, lon: 126.978 };
const BUSAN = { lat: 35.1796, lon: 129.0756 };

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    assert.equal(distanceMeters(SEOUL, SEOUL), 0);
  });

  it('matches the known Seoul–Busan distance within 1%', () => {
    const km = distanceMeters(SEOUL, BUSAN) / 1000;
    assert.ok(Math.abs(km - 325) < 4, `expected ~325km, got ${km.toFixed(1)}km`);
  });

  it('is symmetric', () => {
    assert.equal(
      Math.round(distanceMeters(SEOUL, BUSAN)),
      Math.round(distanceMeters(BUSAN, SEOUL)),
    );
  });
});

describe('cellKey', () => {
  it('buckets a coordinate into a half-degree cell', () => {
    assert.equal(cellKey(37.5665, 126.978), '75_253');
  });

  it('gives the same key to two points in one cell', () => {
    assert.equal(cellKey(37.5, 126.5), cellKey(37.9, 126.9));
  });

  it('gives different keys across a boundary', () => {
    assert.notEqual(cellKey(37.4, 127.0), cellKey(37.6, 127.0));
  });
});

describe('cellsNear', () => {
  it('returns the containing cell first', () => {
    assert.equal(cellsNear(SEOUL.lat, SEOUL.lon)[0], cellKey(SEOUL.lat, SEOUL.lon));
  });

  it('returns the 3x3 block around the point', () => {
    assert.equal(new Set(cellsNear(SEOUL.lat, SEOUL.lon)).size, 9);
  });
});

describe('formatDistance', () => {
  it('uses metres below a kilometre', () => {
    assert.equal(formatDistance(840), '840m');
  });

  it('rounds metres to a readable step', () => {
    assert.equal(formatDistance(843), '840m');
  });

  it('uses kilometres above that', () => {
    assert.equal(formatDistance(1250), '1.3km');
  });
});
