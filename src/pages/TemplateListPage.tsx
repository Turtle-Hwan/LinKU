import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { FileText, FileUp, LayoutTemplate, Plus, Sparkles } from 'lucide-react';
import { TemplateCard } from '@/components/Editor/TemplatePreview/TemplateCard';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useSelectedTemplate } from '@/hooks/useSelectedTemplate';
import type { Template, TemplateSummary } from '@/types/api';
import {
  deleteTemplateFromLocalStorage,
  getTemplatesIndex,
  importSharedTemplate,
  loadTemplateFromLocalStorage,
} from '@/utils/templateStorage';
import {
  createTemplateShareUrl,
  downloadTemplatePayload,
  MAX_SHARE_FILE_BYTES,
  portablePayloadToTemplate,
  validateTemplateSharePayload,
} from '@/utils/templateShare';
import { createBundledDefaultTemplate } from '@/utils/defaultTemplate';
import {
  resolveLatestBulletin,
  subscribeLatestBulletin,
} from '@/apis/external/bulletin';
import { errorLog } from '@/utils/logger';
import {
  sendTemplateApply,
  sendTemplateCreateStart,
  sendTemplateDelete,
} from '@/utils/analytics';

function toSummary(template: Template): TemplateSummary {
  return {
    templateId: template.templateId,
    name: template.name,
    height: template.height,
    cloned: template.cloned,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    itemCount: template.items.length,
    syncStatus: 'local',
    items: template.items,
  };
}

export const TemplateListPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedTemplateId, selectTemplate } = useSelectedTemplate();
  const [defaultTemplate, setDefaultTemplate] = useState(
    createBundledDefaultTemplate,
  );
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'owned' | 'cloned'>('owned');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const applyBulletin = (bulletin: Parameters<typeof createBundledDefaultTemplate>[0]) => {
      setDefaultTemplate(createBundledDefaultTemplate(bulletin));
    };
    const unsubscribe = subscribeLatestBulletin(applyBulletin);
    void resolveLatestBulletin().then(applyBulletin);
    return unsubscribe;
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const index = await getTemplatesIndex();
      const storedTemplates = await Promise.all(
        index.map((entry) => loadTemplateFromLocalStorage(entry.templateId)),
      );
      setTemplates(
        storedTemplates
          .filter((stored) => stored !== null)
          .map((stored) => toSummary(stored.template)),
      );
    } catch (error) {
      errorLog('Failed to load IndexedDB templates', error);
      setTemplates([]);
      toast({
        title: '로컬 저장소 오류',
        description: '기본 템플릿은 계속 사용할 수 있습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    const handleTemplatesChanged = () => void loadTemplates();
    window.addEventListener('linku:templates-changed', handleTemplatesChanged);
    return () => {
      window.removeEventListener('linku:templates-changed', handleTemplatesChanged);
    };
  }, [loadTemplates]);

  const ownedTemplates = useMemo(
    () => [toSummary(defaultTemplate), ...templates.filter((template) => !template.cloned)],
    [defaultTemplate, templates],
  );
  const clonedTemplates = useMemo(
    () => templates.filter((template) => template.cloned),
    [templates],
  );
  const visibleTemplates = activeTab === 'cloned' ? clonedTemplates : ownedTemplates;

  const handleCreateFromDefault = () => {
    sendTemplateCreateStart('default');
    navigate('/editor?from=default');
  };

  const handleCreateEmpty = () => {
    sendTemplateCreateStart('empty');
    navigate('/editor?from=empty');
  };

  const handleApplyTemplate = async (template: TemplateSummary) => {
    const targetId = template.templateId === 0 ? null : template.templateId;
    await selectTemplate(targetId);
    sendTemplateApply(
      template.templateId,
      template.templateId === 0
        ? 'default'
        : template.cloned
          ? 'cloned'
          : 'owned',
      template.templateId === 0,
    );
    toast({
      title: '템플릿 적용 완료',
      description:
        template.templateId === 0
          ? '기본 템플릿이 적용되었습니다.'
          : `“${template.name}” 템플릿이 적용되었습니다.`,
    });
  };

  const handleDeleteTemplate = async (template: TemplateSummary) => {
    if (!confirm(`“${template.name}” 템플릿을 삭제하시겠습니까?`)) return;
    try {
      await deleteTemplateFromLocalStorage(template.templateId);
      setTemplates((current) =>
        current.filter((item) => item.templateId !== template.templateId),
      );
      if (selectedTemplateId === template.templateId) await selectTemplate(null);
      sendTemplateDelete(
        template.templateId,
        template.cloned ? 'cloned' : 'owned',
        'local',
      );
      toast({
        title: '삭제 완료',
        description: '이 기기의 저장소에서 삭제했습니다.',
      });
    } catch (error) {
      errorLog('Failed to delete local template', error);
      toast({
        title: '삭제 실패',
        description: '이 기기의 저장소에서 템플릿을 삭제하지 못했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleShareTemplate = async (templateId: number) => {
    setActionLoading(templateId);
    try {
      const stored =
        templateId === 0
          ? { template: defaultTemplate }
          : await loadTemplateFromLocalStorage(templateId);
      if (!stored) throw new Error('이 기기에서 템플릿을 찾을 수 없습니다.');

      const share = await createTemplateShareUrl(stored.template);
      if (share.mode === 'url') {
        await navigator.clipboard.writeText(share.url);
        toast({
          title: '공유 링크 복사 완료',
          description: '템플릿 데이터는 링크의 fragment에만 들어 있습니다.',
        });
      } else {
        downloadTemplatePayload(share.payload);
        toast({
          title: '공유 파일 저장 완료',
          description: '링크에 담기 큰 템플릿이라 파일로 저장했습니다.',
        });
      }
    } catch (error) {
      errorLog('Failed to share template', error);
      toast({
        title: '공유 실패',
        description:
          error instanceof Error ? error.message : '공유 데이터를 만들지 못했습니다.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > MAX_SHARE_FILE_BYTES) {
        throw new Error('템플릿 가져오기 파일은 256KB 이하여야 합니다.');
      }
      const value: unknown = JSON.parse(await file.text());
      validateTemplateSharePayload(value);
      const imported = await importSharedTemplate(
        portablePayloadToTemplate(value),
      );
      await loadTemplates();
      setActiveTab('cloned');
      toast({
        title: '템플릿 가져오기 완료',
        description: `“${imported.template.name}”을 이 기기에 저장했습니다.`,
      });
    } catch (error) {
      toast({
        title: '가져오기 실패',
        description:
          error instanceof Error ? error.message : '템플릿 파일을 읽지 못했습니다.',
        variant: 'destructive',
      });
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const renderList = () => {
    if (loading) {
      return <p className="py-12 text-center text-muted-foreground">불러오는 중...</p>;
    }
    if (visibleTemplates.length === 0) {
      return (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-muted-foreground">가져온 템플릿이 없습니다.</p>
          <Button size="sm" onClick={() => navigate('/gallery')}>
            <Sparkles className="mr-2 h-4 w-4" />템플릿 둘러보기
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {visibleTemplates.map((template) => (
          <TemplateCard
            key={template.templateId}
            template={template}
            onClick={
              template.templateId === 0
                ? undefined
                : () => navigate(`/editor/${template.templateId}`)
            }
            isSelected={
              selectedTemplateId === null
                ? template.templateId === 0
                : selectedTemplateId === template.templateId
            }
            onApply={(event) => {
              event.stopPropagation();
              void handleApplyTemplate(template);
            }}
            onDelete={(event) => {
              event.stopPropagation();
              void handleDeleteTemplate(template);
            }}
            onShare={(event) => {
              event.stopPropagation();
              void handleShareTemplate(template.templateId);
            }}
            showDelete={template.templateId !== 0}
            isActionLoading={actionLoading === template.templateId}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto h-full max-w-7xl overflow-y-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">내 템플릿</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            로그인이나 서버 연결 없이 이 기기에 바로 저장합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/gallery')}>
            <Sparkles className="mr-2 h-4 w-4" />둘러보기
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />새 템플릿</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCreateFromDefault}>
                <LayoutTemplate className="mr-2 h-4 w-4" />기본 템플릿에서 시작
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCreateEmpty}>
                <FileText className="mr-2 h-4 w-4" />빈 템플릿에서 시작
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => importInputRef.current?.click()}>
                <FileUp className="mr-2 h-4 w-4" />파일에서 가져오기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={importInputRef}
            className="hidden"
            type="file"
            accept=".json,.linku.json,application/json"
            onChange={(event) => void handleImportFile(event.target.files?.[0])}
          />
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'owned' | 'cloned')}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="owned">내가 만든 템플릿 ({ownedTemplates.length})</TabsTrigger>
          <TabsTrigger value="cloned">가져온 템플릿 ({clonedTemplates.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="owned">{renderList()}</TabsContent>
        <TabsContent value="cloned">{renderList()}</TabsContent>
      </Tabs>
    </div>
  );
};
