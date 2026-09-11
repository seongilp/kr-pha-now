/** 상태 하나당 색 하나. 지도 핀과 목록 배지가 같은 곳에서 색을 가져간다. */
import type { OpenStatus } from './types';

export interface StatusStyle {
  label: string;
  pin: string;
  chip: string;
}

/* 회색을 '닫힘'과 '모름'에 같이 쓰지 않는다. 둘을 한 색으로 묶으면 화면이
   "확인해 봤더니 닫혔다"고 말해 버리는데, 모름은 확인을 못 한 것이다. */
export const STATUS_STYLE: Record<OpenStatus, StatusStyle> = {
  open: {
    label: '영업중',
    pin: '#12b76a',
    chip: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
  },
  closed: {
    label: '영업종료',
    pin: '#4b5563',
    chip: 'bg-neutral-500/15 text-neutral-400 ring-1 ring-neutral-500/25',
  },
  unknown: {
    label: '시간 정보 없음',
    pin: '#b45309',
    chip: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
  },
};
