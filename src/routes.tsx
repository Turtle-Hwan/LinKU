/**
 * Route definitions for LinKU Chrome Extension
 * Standard React Router v6 pattern: App as root with nested routes
 */

import { RouteObject } from 'react-router-dom';
import App from '@/App';
import MainLayout from '@/components/MainLayout';
import { EditorLayout } from '@/layouts/EditorLayout';
import { MainPage } from '@/pages/MainPage';
import { EditorPage } from '@/pages/EditorPage';
import { TemplateListPage } from '@/pages/TemplateListPage';
import { GalleryPage } from '@/pages/GalleryPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,  // ← App이 루트 레이아웃
    children: [
      {
        // 팝업 메인 화면
        path: '/',
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
        path: '/editor',
        element: <EditorLayout />,
        children: [
          {
            index: true,
            element: <EditorPage />,
          },
          {
            path: ':templateId',
            element: <EditorPage />,
          },
        ],
      },
      {
        // 템플릿 목록 화면
        path: '/templates',
        element: <EditorLayout />,
        children: [
          {
            index: true,
            element: <TemplateListPage />,
          },
        ],
      },
      {
        // 공개 템플릿 갤러리
        path: '/gallery',
        element: <EditorLayout />,
        children: [
          {
            index: true,
            element: <GalleryPage />,
          },
        ],
      },
      {
        // 404 페이지
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
];
