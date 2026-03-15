import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-start justify-center gap-6 px-6 py-16">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">404</p>
      <h1 data-display="true" className="text-6xl leading-[0.95] tracking-[-0.05em]">
        요청한 경로를 찾을 수 없습니다.
      </h1>
      <p className="max-w-xl text-lg leading-8 text-[var(--muted)]">
        메인 페이지나 설치 가이드, 기능 페이지, 서비스 소개, 로그인 경로를 다시 확인해
        보세요.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="rounded-full border border-black/10 px-5 py-3">
          홈으로 돌아가기
        </Link>
        <Link href="/login" className="rounded-full border border-black/10 px-5 py-3">
          로그인으로 이동
        </Link>
      </div>
    </section>
  );
}
