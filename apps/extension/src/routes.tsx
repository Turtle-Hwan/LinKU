/**
 * Route definitions for LinKU Chrome Extension
 * React Router data routes with App as root and lazy feature screens
 */

import type { RouteObject } from "react-router";
import App from "@/App";
import MainLayout from "@/components/MainLayout";
import { MainPage } from "@/pages/MainPage";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <App />,  // ← App이 루트 레이아웃
    children: [
      {
        // 팝업 메인 화면
        path: "/",
        element: <MainLayout />,
        children: [
          {
            index: true,
            element: <MainPage />,
          },
        ],
      },
      {
        // 에디터 화면
        path: "/editor",
        lazy: async () => {
          const { EditorLayout } = await import("@/layouts/EditorLayout");
          return { Component: EditorLayout };
        },
        children: [
          {
            index: true,
            lazy: async () => {
              const { EditorPage } = await import("@/pages/EditorPage");
              return { Component: EditorPage };
            },
          },
          {
            path: ":templateId",
            lazy: async () => {
              const { EditorPage } = await import("@/pages/EditorPage");
              return { Component: EditorPage };
            },
          },
        ],
      },
      {
        // 템플릿 목록 화면
        path: "/templates",
        lazy: async () => {
          const { EditorLayout } = await import("@/layouts/EditorLayout");
          return { Component: EditorLayout };
        },
        children: [
          {
            index: true,
            lazy: async () => {
              const { TemplateListPage } = await import("@/pages/TemplateListPage");
              return { Component: TemplateListPage };
            },
          },
        ],
      },
      {
        // 공개 템플릿 갤러리
        path: "/gallery",
        lazy: async () => {
          const { EditorLayout } = await import("@/layouts/EditorLayout");
          return { Component: EditorLayout };
        },
        children: [
          {
            index: true,
            lazy: async () => {
              const { GalleryPage } = await import("@/pages/GalleryPage");
              return { Component: GalleryPage };
            },
          },
        ],
      },
      {
        // 404 페이지
        path: "*",
        lazy: async () => {
          const { NotFoundPage } = await import("@/pages/NotFoundPage");
          return { Component: NotFoundPage };
        },
      },
    ],
  },
];
