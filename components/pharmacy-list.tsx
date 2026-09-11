'use client';

import { Clock, Phone } from 'lucide-react';

import { formatDistance } from '@/lib/geo';
import type { Ranked } from '@/lib/nearby';
import { STATUS_STYLE } from '@/lib/status-style';
import { cn } from '@/lib/utils';

const DAY_LABEL = ['월', '화', '수', '목', '금', '토', '일', '공휴일'];

function clock(minutes: number): string {
  const capped = minutes % (24 * 60);
  return `${String(Math.floor(capped / 60)).padStart(2, '0')}:${String(capped % 60).padStart(2, '0')}`;
}

/** 오늘 칸의 운영시간 한 줄. 없으면 그 사실을 그대로 쓴다. */
function todayHours(row: Ranked, dayIndex: number): string {
  const slot = row.pharmacy.h[dayIndex];
  if (!slot) return row.status === 'unknown' ? '운영시간 미신고' : `${DAY_LABEL[dayIndex]} 휴무`;
  return `${clock(slot[0])} - ${clock(slot[1])}`;
}

interface Props {
  rows: readonly Ranked[];
  dayIndex: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PharmacyList({ rows, dayIndex, selectedId, onSelect }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 text-center text-sm text-neutral-400">
        조건에 맞는 약국이 없습니다. 반경을 넓히거나 필터를 꺼 보세요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const style = STATUS_STYLE[row.status];
        const selected = row.pharmacy.i === selectedId;

        return (
          <li key={row.pharmacy.i}>
            <button
              type="button"
              onClick={() => onSelect(row.pharmacy.i)}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'w-full rounded-xl border p-3 text-left transition',
                selected
                  ? 'border-sky-500/60 bg-sky-500/10'
                  : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-700',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-100">{row.pharmacy.n}</p>
                  <p className="truncate text-xs text-neutral-400">{row.pharmacy.a}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px]', style.chip)}>
                    {style.label}
                  </span>
                  <span className="text-xs tabular-nums text-neutral-400">
                    {formatDistance(row.meters)}
                  </span>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden />
                  {todayHours(row, dayIndex)}
                </span>
                {row.pharmacy.t ? (
                  <a
                    href={`tel:${row.pharmacy.t.replace(/[^\d+]/g, '')}`}
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                  >
                    <Phone className="size-3.5" aria-hidden />
                    {row.pharmacy.t}
                  </a>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
