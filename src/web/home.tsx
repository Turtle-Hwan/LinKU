import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ExternalLink, HardDrive, Link2, WifiOff } from 'lucide-react';
import '@/App.css';

const EXTENSION_URL =
  'https://chromewebstore.google.com/detail/linku/fmfbhmifnohhfiblebbdjlioppfppbgh';

const features = [
  {
    icon: <HardDrive className="h-5 w-5" />,
    title: '기기 우선 저장',
    description: '개인 템플릿과 아이콘을 Chrome IndexedDB에 저장합니다.',
  },
  {
    icon: <WifiOff className="h-5 w-5" />,
    title: '서버 없이 편집',
    description: '백엔드 상태와 무관하게 만들고, 적용하고, 수정할 수 있습니다.',
  },
  {
    icon: <Link2 className="h-5 w-5" />,
    title: 'fragment 공유',
    description: '작은 템플릿은 서버에 업로드하지 않고 URL 안에 담습니다.',
  },
];

export function HomePage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-main">
          LOCAL FIRST
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight sm:text-6xl">
          학교 생활 링크를<br />내 방식대로 정리하세요.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          LinKU의 개인 템플릿은 먼저 내 브라우저에 저장됩니다. 로그인이나 서버
          연결이 없어도 핵심 기능을 그대로 사용할 수 있습니다.
        </p>
        <a
          href={EXTENSION_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-flex items-center rounded-lg bg-main px-5 py-3 font-semibold text-white hover:bg-hover"
        >
          Chrome에 추가 <ExternalLink className="ml-2 h-4 w-4" />
        </a>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-2xl border bg-card p-6">
              <div className="text-main">{feature.icon}</div>
              <h2 className="mt-4 font-bold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {feature.description}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HomePage />
  </StrictMode>,
);
