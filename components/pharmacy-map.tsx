'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPinOff } from 'lucide-react';

import { STATUS_STYLE } from '@/lib/status-style';
import type { Ranked } from '@/lib/nearby';

/**
 * 카카오지도. 핀 색이 곧 이 앱의 값이다 — 초록이면 지금 갈 수 있고, 회색이면 닫혔고,
 * 주황이면 운영시간을 신고하지 않은 약국이라 가기 전에 전화를 해야 한다.
 *
 * graceful 원칙(kr-expense-now 와 동일): 키가 없거나, 스크립트가 실패하거나,
 * 도메인이 카카오 콘솔에 등록되지 않아 SDK 가 조용히 준비되지 않으면 안내 문구만
 * 보여주고 끝낸다. 목록은 지도와 무관하게 계속 동작한다.
 */

/* SDK 타입 최소 선언. 공식 d.ts 가 없어 쓰는 것만 적는다. */
interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}
interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void;
  isEmpty(): boolean;
}
interface KakaoMap {
  setCenter(latlng: KakaoLatLng): void;
  setLevel(level: number): void;
  setBounds(
    bounds: KakaoLatLngBounds,
    paddingTop?: number,
    paddingRight?: number,
    paddingBottom?: number,
    paddingLeft?: number,
  ): void;
}
interface KakaoOverlay {
  setMap(map: KakaoMap | null): void;
}
interface KakaoMaps {
  load(cb: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Map: new (el: HTMLElement, opts: { center: KakaoLatLng; level: number }) => KakaoMap;
  CustomOverlay: new (opts: {
    position: KakaoLatLng;
    content: string;
    yAnchor?: number;
    zIndex?: number;
  }) => KakaoOverlay;
}
declare global {
  interface Window {
    kakao?: { maps?: KakaoMaps };
  }
}

type SdkState = 'nokey' | 'loading' | 'ready' | 'failed';

const KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
const SDK_TIMEOUT_MS = 10_000;
const FIT_PADDING = 56;
/** 주변 몇 곳만 잡힐 때 지도가 과하게 확대되지 않도록 하는 하한. */
const MIN_LEVEL = 4;

function loadSdk(onDone: (ok: boolean) => void): () => void {
  if (window.kakao?.maps) {
    onDone(true);
    return () => {};
  }

  let settled = false;
  const finish = (ok: boolean) => {
    if (settled) return;
    settled = true;
    onDone(ok);
  };

  const script = document.createElement('script');
  script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KEY ?? '')}&autoload=false`;
  script.async = true;
  script.onload = () => {
    // 도메인 미등록이면 스크립트는 200 이지만 load 콜백이 오지 않는다 → 타임아웃이 잡는다.
    try {
      window.kakao?.maps?.load(() => finish(true));
    } catch {
      finish(false);
    }
  };
  script.onerror = () => finish(false);
  document.head.appendChild(script);

  const timer = setTimeout(() => finish(false), SDK_TIMEOUT_MS);
  return () => clearTimeout(timer);
}

function pinHtml(id: string, color: string, selected: boolean): string {
  const size = selected ? 18 : 13;
  const ring = selected ? '3px solid #fff' : '2px solid rgba(255,255,255,.75)';
  // data-pin 은 클릭 위임이 잡는 앵커다. CustomOverlay 의 content 는 평범한 DOM 이라
  // 마커마다 리스너를 다는 대신 컨테이너 한 곳에서 받는다.
  return (
    `<div data-pin="${id}" style="width:${size}px;height:${size}px;border-radius:9999px;` +
    `background:${color};border:${ring};box-shadow:0 1px 6px rgba(0,0,0,.5);cursor:pointer"></div>`
  );
}

function meHtml(): string {
  return (
    '<div style="width:14px;height:14px;border-radius:9999px;background:#3182f6;' +
    'border:3px solid #fff;box-shadow:0 0 0 6px rgba(49,130,246,.25)"></div>'
  );
}

interface Props {
  rows: readonly Ranked[];
  origin: { lat: number; lon: number };
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PharmacyMap({ rows, origin, selectedId, onSelect }: Props) {
  const [sdk, setSdk] = useState<SdkState>(KEY ? 'loading' : 'nokey');
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef<KakaoOverlay[]>([]);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!KEY) return;
    return loadSdk((ok) => {
      const maps = window.kakao?.maps;
      if (!ok || !maps || !boxRef.current) {
        setSdk('failed');
        return;
      }
      mapRef.current = new maps.Map(boxRef.current, {
        center: new maps.LatLng(origin.lat, origin.lon),
        level: 5,
      });
      setSdk('ready');
    });
    // 지도는 한 번만 만든다. 이후 이동은 rows 효과가 맡는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 핀 다시 그리기. 개수가 수백이라 마커를 지우고 새로 찍는 편이 단순하고 충분히 빠르다.
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (sdk !== 'ready' || !maps || !map) return;

    for (const overlay of overlaysRef.current) overlay.setMap(null);
    overlaysRef.current = [];

    const bounds = new maps.LatLngBounds();

    const me = new maps.CustomOverlay({
      position: new maps.LatLng(origin.lat, origin.lon),
      content: meHtml(),
      zIndex: 1,
    });
    me.setMap(map);
    overlaysRef.current.push(me);
    bounds.extend(new maps.LatLng(origin.lat, origin.lon));

    for (const row of rows) {
      const position = new maps.LatLng(row.pharmacy.y, row.pharmacy.x);
      const selected = row.pharmacy.i === selectedId;
      const overlay = new maps.CustomOverlay({
        position,
        content: pinHtml(row.pharmacy.i, STATUS_STYLE[row.status].pin, selected),
        zIndex: selected ? 5 : 2,
      });
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
      bounds.extend(position);
    }

    if (!bounds.isEmpty()) {
      map.setBounds(bounds, FIT_PADDING, FIT_PADDING, FIT_PADDING, FIT_PADDING);
    }
  }, [rows, origin, selectedId, sdk]);

  // 핀 클릭은 컨테이너에 위임한다. CustomOverlay 의 content 는 평범한 DOM 이다.
  useEffect(() => {
    const box = boxRef.current;
    if (sdk !== 'ready' || !box) return;

    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const id = event.target.closest<HTMLElement>('[data-pin]')?.dataset.pin;
      if (id) selectRef.current(id);
    };
    box.addEventListener('click', onClick);
    return () => box.removeEventListener('click', onClick);
  }, [sdk]);

  if (sdk === 'nokey' || sdk === 'failed') {
    return (
      <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
        <MapPinOff className="size-5 text-neutral-500" aria-hidden />
        <p className="text-sm text-neutral-400">
          {sdk === 'nokey'
            ? '지도 키가 설정되지 않았습니다.'
            : '지도를 불러오지 못했습니다.'}
        </p>
        <p className="text-xs text-neutral-500">아래 목록은 그대로 쓸 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div
      ref={boxRef}
      className="h-full min-h-64 w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900"
      aria-label="주변 약국 지도"
    />
  );
}
