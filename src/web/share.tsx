import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TemplatePreviewCanvas } from '@/components/Editor/TemplatePreview/TemplatePreviewCanvas';
import {
  CHROME_EXTENSION_ID,
  CHROME_WEB_STORE_URL,
} from '@/constants/extension';
import type { Template } from '@/types/api';
import type {
  TemplateShareImportResponse,
  TemplateSharePayloadV1,
} from '@/types/templateShare';
import {
  decodeTemplateSharePayload,
  downloadTemplatePayload,
  portablePayloadToTemplate,
} from '@/utils/templateShare';
import '@/App.css';

async function importIntoExtension(
  payload: TemplateSharePayloadV1,
): Promise<TemplateShareImportResponse> {
  const runtime = globalThis.chrome?.runtime;
  if (!runtime?.sendMessage) {
    throw new Error('LinKU 확장 프로그램을 찾을 수 없습니다.');
  }
  const response = (await runtime.sendMessage(CHROME_EXTENSION_ID, {
    type: 'IMPORT_SHARED_TEMPLATE',
    data: { payload },
  })) as TemplateShareImportResponse | undefined;
  if (!response?.success) {
    throw new Error(response?.error || '확장 프로그램으로 가져오지 못했습니다.');
  }
  return response;
}

export function MessagePage({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-20 text-center">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-4 leading-7 text-muted-foreground">{message}</p>
      <a className="mt-8 inline-flex text-sm font-semibold text-main" href="../">
        LinKU 소개로 돌아가기
      </a>
    </main>
  );
}

export function SharedTemplatePage({
  payload,
  template,
}: {
  payload: TemplateSharePayloadV1;
  template: Template;
}) {
  const [status, setStatus] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    if (isImporting) return;
    setIsImporting(true);
    setStatus('가져오는 중...');
    try {
      const response = await importIntoExtension(payload);
      setStatus(
        response.alreadyQueued
          ? '이미 대기 중인 가져오기 요청입니다. LinKU를 열어 완료해 주세요.'
          : '가져오기 요청을 저장했습니다. LinKU를 열면 이 기기에 추가됩니다.',
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '가져오지 못했습니다.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <p className="text-sm font-semibold text-main">공유 템플릿</p>
      <h1 className="mt-2 text-3xl font-bold">{template.name}</h1>
      <p className="mt-2 text-muted-foreground">
        {template.items.length}개 링크 · {template.height}행
      </p>
      <div className="mt-8 overflow-hidden rounded-xl border">
        <TemplatePreviewCanvas items={template.items} height={template.height} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={handleImport} disabled={isImporting}>
          {isImporting ? '가져오는 중...' : 'LinKU로 가져오기'}
        </Button>
        <Button variant="outline" onClick={() => downloadTemplatePayload(payload)}>
          <Download className="mr-2 h-4 w-4" />파일로 저장
        </Button>
        <Button variant="ghost" asChild>
          <a href={CHROME_WEB_STORE_URL} target="_blank" rel="noreferrer">
            확장 프로그램 설치 <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>
      {status && <p className="mt-4 text-sm text-muted-foreground">{status}</p>}
      <p className="mt-10 text-xs leading-5 text-muted-foreground">
        이 페이지는 URL의 # 뒤에 담긴 데이터를 브라우저에서만 읽습니다. 템플릿
        내용은 GitHub Pages 서버로 전송되지 않습니다.
      </p>
    </main>
  );
}

export function ShareApp() {
  const [hash, setHash] = useState(() => window.location.hash);
  const [sharedTemplate, setSharedTemplate] = useState<{
    payload: TemplateSharePayloadV1;
    template: Template;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    let active = true;
    setSharedTemplate(null);
    setError('');
    void decodeTemplateSharePayload(hash)
      .then((decoded) => {
        if (active) {
          setSharedTemplate({
            payload: decoded,
            template: portablePayloadToTemplate(decoded),
          });
        }
      })
      .catch((decodeError: unknown) => {
        if (active) {
          setError(
            decodeError instanceof Error
              ? decodeError.message
              : '공유 링크를 읽지 못했습니다.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [hash]);

  if (error) return <MessagePage title="공유 링크 오류" message={error} />;
  if (!sharedTemplate) {
    return <MessagePage title="공유 템플릿" message="읽는 중..." />;
  }
  return <SharedTemplatePage {...sharedTemplate} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ShareApp />
  </StrictMode>,
);
