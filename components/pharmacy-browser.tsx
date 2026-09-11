'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Crosshair, LoaderCircle, LocateFixed } from 'lucide-react';

import { dayIndex, isHoliday } from '@/lib/hours';
import { loadIndex, loadNear, type DataIndex } from '@/lib/load-tiles';
import { rank } from '@/lib/nearby';
import { STATUS_STYLE } from '@/lib/status-style';
import type { Pharmacy } from '@/lib/types';
import { cn } from '@/lib/utils';

import { PharmacyList } from './pharmacy-list';
import { PharmacyMap } from './pharmacy-map';

/** 위치를 못 받았을 때 설 자리. 서울시청. */
const FALLBACK = { lat: 37.5665, lon: 126.978 };
const RADIUS_CHOICES = [1000, 3000, 10_000] as const;

type Located = 'asking' | 'gps' | 'fallback';

export function PharmacyBrowser() {
  const [index, setIndex] = useState<DataIndex | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  /** 내 위치. 지도의 파란 점. */
  const [me, setMe] = useState(FALLBACK);
  /** 검색 중심. 지도를 옮기면 여기가 바뀐다 — 옮긴 자리의 약국을 보여주기 위해서. */
  const [center, setCenter] = useState(FALLBACK);
  /** 값이 바뀔 때만 지도를 결과에 맞춘다. */
  const [fitNonce, setFitNonce] = useState(0);
  const [movedByUser, setMovedByUser] = useState(false);
  const [located, setLocated] = useState<Located>('asking');
  const [openOnly, setOpenOnly] = useState(true);
  const [radius, setRadius] = useState<number>(3000);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 1분마다 다시 판정한다. 19:00 에 닫는 약국을 19:01 에도 열렸다고 두면 앱이 거짓말을 한다.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadIndex().then(setIndex).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      // 결과를 콜백과 같은 비동기 경로로 흘려보낸다. 효과 본문에서 바로 상태를
      // 바꾸면 렌더가 연쇄로 한 번 더 돈다.
      const timer = setTimeout(() => setLocated('fallback'), 0);
      return () => clearTimeout(timer);
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here = { lat: position.coords.latitude, lon: position.coords.longitude };
        setMe(here);
        setCenter(here);
        setFitNonce((n) => n + 1);
        setLocated('gps');
      },
      // 거부·실패는 오류가 아니다. 서울시청 기준으로 보여주고 그렇다고 말한다.
      () => setLocated('fallback'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    if (!index) return;
    loadNear(center.lat, center.lon, index)
      .then(setPharmacies)
      .catch((e: Error) => setError(e.message));
  }, [index, center]);

  const holidays = useMemo(() => new Set(index?.holidays ?? []), [index]);
  const rows = useMemo(
    () => rank(pharmacies, center, now, holidays, { openOnly, radiusMeters: radius }),
    [pharmacies, center, now, holidays, openOnly, radius],
  );

  const onMapMove = useCallback((next: { lat: number; lon: number }) => {
    setCenter(next);
    setMovedByUser(true);
  }, []);

  const backToMe = useCallback(() => {
    setCenter(me);
    setMovedByUser(false);
    setFitNonce((n) => n + 1);
  }, [me]);

  const today = dayIndex(now, holidays);
  const holidayToday = isHoliday(now, holidays);
  const openCount = rows.filter((row) => row.status === 'open').length;

  if (error) {
    return (
      <p className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">
        데이터를 불러오지 못했습니다: {error}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded-full px-3 py-1 text-xs',
            holidayToday
              ? 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30'
              : 'bg-neutral-800 text-neutral-300',
          )}
        >
          {holidayToday ? '오늘은 공휴일' : ['월', '화', '수', '목', '금', '토', '일'][today]}요일
        </span>

        <button
          type="button"
          onClick={() => setOpenOnly((value) => !value)}
          aria-pressed={openOnly}
          className={cn(
            'rounded-full px-3 py-1 text-xs transition',
            openOnly
              ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
              : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200',
          )}
        >
          지금 문 연 곳만
        </button>

        <div className="flex items-center gap-1" role="group" aria-label="반경">
          {RADIUS_CHOICES.map((meters) => (
            <button
              key={meters}
              type="button"
              onClick={() => {
                setRadius(meters);
                setFitNonce((n) => n + 1);
              }}
              aria-pressed={radius === meters}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs transition',
                radius === meters
                  ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40'
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200',
              )}
            >
              {meters >= 1000 ? `${meters / 1000}km` : `${meters}m`}
            </button>
          ))}
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-sm text-neutral-400">
        {located === 'asking' ? (
          <>
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            위치를 확인하는 중
          </>
        ) : (
          <>
            <Crosshair className="size-3.5" aria-hidden />
            {movedByUser
              ? '지도에서 찾은 위치 기준'
              : located === 'gps'
                ? '현재 위치 기준'
                : '서울시청 기준 (위치 권한 없음)'}{' '}
            · 영업중 <strong className="text-emerald-400">{openCount}</strong>곳 / 표시{' '}
            {rows.length}곳
            {movedByUser ? (
              <button
                type="button"
                onClick={backToMe}
                className="ml-1 inline-flex items-center gap-1 rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-sky-300 transition hover:bg-neutral-700"
              >
                <LocateFixed className="size-3.5" aria-hidden />
                내 위치로
              </button>
            ) : null}
          </>
        )}
      </p>

      {/* 데스크탑에서는 지도를 왼쪽에 고정하고 목록을 오른쪽에서 스크롤한다.
          좁은 화면에서는 지도 → 목록으로 그냥 쌓인다. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] lg:items-start lg:gap-5">
        <div className="flex flex-col gap-3 lg:sticky lg:top-6">
          <PharmacyMap
            rows={rows}
            me={me}
            center={center}
            fitNonce={fitNonce}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={onMapMove}
          />

          <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
            {(['open', 'closed', 'unknown'] as const).map((status) => (
              <span key={status} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ background: STATUS_STYLE[status].pin }}
                  aria-hidden
                />
                {STATUS_STYLE[status].label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 lg:mt-0">
          <PharmacyList
            rows={rows}
            dayIndex={today}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </div>
    </div>
  );
}
