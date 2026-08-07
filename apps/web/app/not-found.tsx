import Link from "next/link";
import { Button } from "@linku/ui";

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-start justify-center gap-4 px-4 py-10 sm:px-6">
      <p className="text-sm font-medium text-main">404</p>
      <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        요청한 경로를 찾을 수 없습니다.
      </h1>
      <p className="max-w-xl text-base leading-7 text-muted-foreground">
        주소를 다시 확인하거나 홈으로 돌아가 주세요.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/">홈으로 돌아가기</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">로그인으로 이동</Link>
        </Button>
      </div>
    </section>
  );
}
