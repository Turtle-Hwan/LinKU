"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FlaskConical, Globe, Search, Settings } from "lucide-react";
import {
  WORKSPACE_QUICK_LINKS,
  localizeWorkspaceText,
} from "@linku/platform";
import {
  Badge,
  Input,
  ShortcutGrid,
  ShortcutTile,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@linku/ui";
import { WorkspaceShortcutIcon } from "@/components/workspace-shortcut-icon";
import { GitHubMark } from "@/components/github-mark";
import type { AppLocale } from "@/i18n/routing";

const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 600;

interface LinkuCardPreviewProps {
  locale: AppLocale;
}

export function LinkuCardPreview({ locale }: LinkuCardPreviewProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const copy =
    locale === "ko"
      ? {
          search: "검색어 입력",
          links: "링크모음",
          alerts: "공지사항",
          timetable: "시간표",
          todos: "Todo List",
          timetableEmpty: "시간표는 준비 중입니다",
          todoEmpty: "할 일이 없습니다",
        }
      : {
          search: "Search",
          links: "Links",
          alerts: "Alerts",
          timetable: "Timetable",
          todos: "Todo List",
          timetableEmpty: "The timetable is being prepared",
          todoEmpty: "There are no todos",
        };

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / POPUP_WIDTH));
    });

    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={shellRef}
      className="relative mx-auto w-full max-w-[500px] min-w-0 overflow-hidden"
      style={{ height: POPUP_HEIGHT * scale }}
    >
      <div
        className="absolute left-0 top-0 flex h-[600px] w-[500px] origin-top-left flex-col overflow-hidden rounded-lg border bg-white"
        style={{ transform: `scale(${scale})` }}
        aria-label={locale === "ko" ? "LinKU 확장 프로그램 화면" : "LinKU extension view"}
      >
        <header className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <Image
              src="/brand/linku-logo.svg"
              alt="LinKU"
              width={112}
              height={36}
              priority
            />
            <div className="relative flex-1">
              <Input
                placeholder={copy.search}
                readOnly
                aria-label={copy.search}
                className="w-full py-2 pl-10 pr-4"
              />
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            </div>
            <div className="flex shrink-0 items-center gap-2 text-gray-600">
              <FlaskConical className="size-5" aria-hidden="true" />
              <Globe className="size-5" aria-hidden="true" />
              <Settings className="size-5" aria-hidden="true" />
              <GitHubMark className="size-5" aria-hidden="true" />
            </div>
          </div>
        </header>

        <Tabs defaultValue="links" className="min-h-0 flex-1">
          <div className="px-3">
            <TabsList className="w-full">
              <TabsTrigger value="links">{copy.links}</TabsTrigger>
              <TabsTrigger value="alerts">{copy.alerts}</TabsTrigger>
              <TabsTrigger value="timetable">{copy.timetable}</TabsTrigger>
              <TabsTrigger value="todos">
                {copy.todos}
                <Badge className="h-5 min-w-5 px-1.5">3</Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="links" className="min-h-0">
            <ShortcutGrid className="Link__Grid">
              {WORKSPACE_QUICK_LINKS.map((shortcut) => (
                <ShortcutTile
                  key={shortcut.id}
                  wide={shortcut.wide}
                  icon={
                    <WorkspaceShortcutIcon
                      icon={shortcut.icon}
                      className="Icon__Animation size-5"
                    />
                  }
                  label={localizeWorkspaceText(shortcut.title, locale)}
                />
              ))}
            </ShortcutGrid>
          </TabsContent>

          <TabsContent value="alerts" className="border-t p-4">
            <div className="grid gap-3">
              {[
                locale === "ko" ? "학사 일정 안내" : "Academic calendar update",
                locale === "ko" ? "장학금 신청 안내" : "Scholarship application notice",
                locale === "ko" ? "학생 지원 프로그램" : "Student support program",
              ].map((title, index) => (
                <div key={title} className="rounded-lg border p-4">
                  <Badge variant="outline">
                    {index === 0 ? (locale === "ko" ? "학사" : "Academic") : locale === "ko" ? "일반" : "General"}
                  </Badge>
                  <p className="mt-2 text-base font-medium">{title}</p>
                  <p className="mt-2 text-xs text-muted-foreground">2026.07.31</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="timetable" className="border-t p-8 text-center">
            {copy.timetableEmpty}
          </TabsContent>

          <TabsContent value="todos" className="border-t p-4">
            <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
              {copy.todoEmpty}
            </p>
          </TabsContent>
        </Tabs>

        <div className="relative mt-auto h-[85px] shrink-0 overflow-hidden">
          <Image
            src="/brand/linku-banner.png"
            alt={locale === "ko" ? "LinKU 배너" : "LinKU banner"}
            fill
            sizes="500px"
            className="object-cover"
          />
        </div>
      </div>
    </div>
  );
}
