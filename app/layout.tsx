import type { Metadata, Viewport } from 'next';

import './globals.css';

const TITLE = '약국 나우 — 지금 문 연 약국';
const DESCRIPTION =
  '내 주변에서 지금 영업 중인 약국을 지도에서 찾습니다. 공휴일·주말 운영시간까지 반영합니다.';

export const metadata: Metadata = {
  metadataBase: new URL('https://kr-pha-now.vercel.app'),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website', locale: 'ko_KR' },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
