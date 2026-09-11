import { PharmacyBrowser } from '@/components/pharmacy-browser';

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 lg:max-w-6xl lg:px-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">약국 나우</h1>
        <p className="mt-1 text-sm text-neutral-400">지금 문 연 약국을 내 주변에서 찾습니다.</p>
      </header>

      <PharmacyBrowser />

      <footer className="mt-10 border-t border-neutral-900 pt-4 text-xs leading-relaxed text-neutral-500">
        <p>
          출처: 국립중앙의료원 전국 약국 정보, 한국천문연구원 특일 정보 (공공데이터포털).
        </p>
        <p className="mt-1">
          운영시간은 약국이 신고한 값이라 실제와 다를 수 있습니다. 가시기 전에 전화로 확인하세요.
        </p>
      </footer>
    </main>
  );
}
