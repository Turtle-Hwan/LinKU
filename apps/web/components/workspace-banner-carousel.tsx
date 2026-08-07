"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  WORKSPACE_BANNERS,
  WORKSPACE_BANNER_ASSET_BASE_URL,
} from "@linku/platform";
import { Button } from "@linku/ui";
import type { AppLocale } from "@/i18n/routing";

export function WorkspaceBannerCarousel({ locale }: { locale: AppLocale }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % WORKSPACE_BANNERS.length);
    }, 7000);

    return () => window.clearInterval(timer);
  }, []);

  function move(direction: -1 | 1) {
    setActiveIndex(
      (current) =>
        (current + direction + WORKSPACE_BANNERS.length) %
        WORKSPACE_BANNERS.length,
    );
  }

  return (
    <div
      className="group relative h-[85px] overflow-hidden border-t bg-main"
      aria-label={locale === "ko" ? "LinKU 배너" : "LinKU banners"}
    >
      <div
        className="flex h-full transition-transform duration-300"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {WORKSPACE_BANNERS.map((banner) => (
          <a
            key={banner.img}
            href={banner.link}
            target="_blank"
            rel="noreferrer"
            className="h-full min-w-full"
          >
            <img
              src={`${WORKSPACE_BANNER_ASSET_BASE_URL}/${banner.img}`}
              alt={banner.alt}
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.src = "/brand/linku-banner.png";
              }}
            />
          </a>
        ))}
      </div>

      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute left-2 top-1/2 size-7 -translate-y-1/2 rounded-full bg-white/80 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={locale === "ko" ? "이전 배너" : "Previous banner"}
        onClick={() => move(-1)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute right-2 top-1/2 size-7 -translate-y-1/2 rounded-full bg-white/80 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={locale === "ko" ? "다음 배너" : "Next banner"}
        onClick={() => move(1)}
      >
        <ChevronRight className="size-4" />
      </Button>

      <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1.5">
        {WORKSPACE_BANNERS.map((banner, index) => (
          <button
            key={banner.img}
            type="button"
            className={`size-2 rounded-full ${
              index === activeIndex ? "bg-white" : "bg-white/50"
            }`}
            aria-label={
              locale === "ko"
                ? `${index + 1}번째 배너 보기`
                : `Show banner ${index + 1}`
            }
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}
