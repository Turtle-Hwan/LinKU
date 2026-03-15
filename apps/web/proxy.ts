import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const localeCookie = {
  name: "NEXT_LOCALE",
  options: {
    path: "/",
    sameSite: "lax" as const,
  },
};

function getLocalizedPathname(pathname: string, locale: string) {
  if (locale === routing.defaultLocale) {
    return pathname;
  }

  return pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
}

function shouldUseEnglish(request: NextRequest) {
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;

  if (cookieLocale === "en") {
    return true;
  }

  if (cookieLocale === "ko") {
    return false;
  }

  const acceptLanguage = request.headers.get("accept-language")?.toLowerCase() ?? "";
  return acceptLanguage.startsWith("en");
}

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const locale = shouldUseEnglish(request) ? "en" : routing.defaultLocale;
  const localizedPathname = getLocalizedPathname(pathname, locale);

  if (locale !== routing.defaultLocale) {
    const response = NextResponse.redirect(new URL(`${localizedPathname}${search}`, request.url));
    response.cookies.set(localeCookie.name, locale, localeCookie.options);
    return response;
  }

  const response = NextResponse.rewrite(
    new URL(`/${routing.defaultLocale}${pathname === "/" ? "" : pathname}${search}`, request.url),
  );
  response.cookies.set(localeCookie.name, locale, localeCookie.options);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|en(?:/|$)|ko(?:/|$)|.*\\..*).*)"],
};
