import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  Cloud,
  CloudOff,
  DatabaseBackup,
  FileText,
  LayoutTemplate,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
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
  createTemplateBackup,
  countQuarantinedRecords,
  deleteLocalTemplate,
  isTemplateBackupValidationError,
  listQuarantinedRecords,
  listLocalTemplates,
  MAX_TEMPLATE_BACKUP_BYTES,
  PublishedTemplateDeleteError,
  restoreTemplateBackup,
} from '@/storage/templates/repository';
import { createBundledDefaultTemplate } from '@/utils/defaultTemplate';
import {
  resolveLatestBulletin,
  subscribeLatestBulletin,
} from '@/apis/external/bulletin';
import { UNSAVED_TEMPLATE_ID } from '@/constants/template';
import { downloadJson } from '@/utils/download';
import { captureErrorLog, warnLog } from '@/utils/logger';
import { UserFacingError } from '@/errors/userFacingError';
import { recordBreadcrumb } from '@/monitoring';
import {
  isPublicationOutdated,
  publishLocalTemplate,
  refreshPublicationMetadata,
  unpublishLocalTemplate,
} from '@/apis/supabase/community';
import { SupabaseConfigurationError } from '@/apis/supabase/client';
import {
  getTemplateAccountStates,
} from '@/storage/account/syncRepository';
import type { AccountSyncStatus } from '@/types/account';
import { syncAccount } from '@/utils/accountSync';
import { getAccountSyncFeedback } from '@/utils/accountSyncResult';
import { isExpectedNetworkFailure } from '@/utils/networkFailure';
import { isLoggedIn, startGoogleLogin } from '@/utils/oauth';
import {
  sendTemplateApply,
  sendTemplateCreateStart,
  sendTemplateDelete,
} from '@/utils/analytics';

interface TemplateListItem extends TemplateSummary {
  syncId?: string;
  accountSyncStatus: AccountSyncStatus;
  published: boolean;
  publicationOutdated: boolean;
}

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

function reportTemplateOperationFailure(message: string, error: unknown) {
  if (
    isTemplateBackupValidationError(error) ||
    error instanceof UserFacingError ||
    error instanceof PublishedTemplateDeleteError ||
    error instanceof SupabaseConfigurationError ||
    isExpectedNetworkFailure(error)
  ) {
    recordBreadcrumb(
      'template.operation',
      message,
      {
        reason:
          error instanceof UserFacingError
            ? error.code
            : error instanceof SupabaseConfigurationError
              ? 'not_configured'
              : isExpectedNetworkFailure(error)
                ? 'network'
                : 'local_state',
      },
      'warning',
    );
    warnLog(message, error);
    return;
  }

  captureErrorLog(message, error);
}

export const TemplateListPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedTemplateId, selectTemplate } = useSelectedTemplate();
  const [defaultTemplate, setDefaultTemplate] = useState(
    createBundledDefaultTemplate,
  );
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'owned' | 'cloned'>('owned');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [accountConnected, setAccountConnected] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const loadRequestIdRef = useRef(0);
  const [quarantinedCount, setQuarantinedCount] = useState(0);

  useEffect(() => {
    const applyBulletin = (bulletin: Parameters<typeof createBundledDefaultTemplate>[0]) => {
      setDefaultTemplate(createBundledDefaultTemplate(bulletin));
    };
    const unsubscribe = subscribeLatestBulletin(applyBulletin);
    void resolveLatestBulletin().then(applyBulletin);
    return unsubscribe;
  }, []);

  const loadTemplates = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    try {
      const storedTemplates = await listLocalTemplates();
      const nextQuarantinedCount = await countQuarantinedRecords();
      let connected = false;
      try {
        connected = await isLoggedIn();
        if (connected) {
          await refreshPublicationMetadata();
        }
      } catch (error) {
        reportTemplateOperationFailure(
          'Failed to refresh publication metadata',
          error,
        );
      }
      const accountStates = await getTemplateAccountStates(
        storedTemplates.map((stored) => stored.template.id),
      );
      const nextTemplates = await Promise.all(
        storedTemplates.map(async (stored): Promise<TemplateListItem> => {
          const syncId = stored.template.id;
          const accountState = accountStates.get(syncId) ?? {
            status: 'local' as const,
            isPublished: false,
          };
          return {
            ...toSummary(stored.template),
            syncId,
            accountSyncStatus: accountState.status,
            published: accountState.isPublished,
            publicationOutdated:
              accountState.isPublished &&
              (await isPublicationOutdated(
                stored,
                accountState.publishedContentHash,
              )),
          };
        }),
      );
      if (requestId !== loadRequestIdRef.current) return;

      setTemplates(nextTemplates);
      setAccountConnected(connected);
      // Reading is what moves an unreadable record into quarantine, so the
      // count is refreshed here rather than on mount.
      setQuarantinedCount(nextQuarantinedCount);
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return;
      captureErrorLog('Failed to load IndexedDB templates', error);
      setTemplates([]);
      toast({
        title: '로컬 저장소 오류',
        description: '기본 템플릿은 계속 사용할 수 있습니다.',
        variant: 'destructive',
      });
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
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
    (): TemplateListItem[] => [
      {
        ...toSummary(defaultTemplate),
        accountSyncStatus: 'local',
        published: false,
        publicationOutdated: false,
      },
      ...templates.filter((template) => !template.cloned),
    ],
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
    const targetId = template.templateId === UNSAVED_TEMPLATE_ID ? null : template.templateId;
    if (!(await selectTemplate(targetId))) {
      toast({
        title: '적용 실패',
        description: '템플릿 선택을 이 기기에 저장하지 못했습니다.',
        variant: 'destructive',
      });
      return;
    }
    sendTemplateApply(
      template.templateId,
      template.templateId === UNSAVED_TEMPLATE_ID
        ? 'default'
        : template.cloned
          ? 'cloned'
          : 'owned',
      template.templateId === UNSAVED_TEMPLATE_ID,
    );
    toast({
      title: '템플릿 적용 완료',
      description:
        template.templateId === UNSAVED_TEMPLATE_ID
          ? '기본 템플릿이 적용되었습니다.'
          : `“${template.name}” 템플릿이 적용되었습니다.`,
    });
  };

  const handleDeleteTemplate = async (template: TemplateListItem) => {
    if (template.published) {
      toast({
        title: '게시 중인 템플릿',
        description: '게시를 내린 뒤 삭제해 주세요.',
      });
      return;
    }
    if (!confirm(`“${template.name}” 템플릿을 삭제하시겠습니까?`)) return;
    try {
      if (
        selectedTemplateId === template.templateId &&
        !(await selectTemplate(null))
      ) {
        // selectTemplate owns and reports its chrome.storage failure. Throwing
        // a new wrapper here would create a second Sentry issue without the
        // original error details.
        toast({
          title: '삭제 실패',
          description: '템플릿 선택 상태를 해제하지 못했습니다.',
          variant: 'destructive',
        });
        return;
      }
      await deleteLocalTemplate(template.templateId);
      setTemplates((current) =>
        current.filter((item) => item.templateId !== template.templateId),
      );
      sendTemplateDelete(
        template.templateId,
        template.cloned ? 'cloned' : 'owned',
        'local',
      );
      toast({
        title: '삭제 완료',
        description: '이 기기의 저장소에서 삭제했습니다.',
      });
      window.dispatchEvent(new Event('linku:templates-changed'));
    } catch (error) {
      reportTemplateOperationFailure('Failed to delete local template', error);
      toast({
        title: '삭제 실패',
        description:
          error instanceof Error
            ? error.message
            : '이 기기의 저장소에서 템플릿을 삭제하지 못했습니다.',
        variant: 'destructive',
      });
    }
  };

  const ensureAccount = async (): Promise<boolean> => {
    if (await isLoggedIn()) return true;
    const result = await startGoogleLogin();
    if (!result.success) {
      toast({ title: 'Google 로그인 필요', description: result.error });
      return false;
    }
    setAccountConnected(true);
    return true;
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      if (!(await ensureAccount())) return;
      const result = await syncAccount();
      const feedback = getAccountSyncFeedback(result);
      toast({
        title: feedback.title,
        description: feedback.description,
        variant: feedback.destructive ? 'destructive' : 'default',
      });
      await loadTemplates();
    } catch (error) {
      reportTemplateOperationFailure('Failed to sync templates', error);
      toast({
        title: '동기화 실패',
        description:
          error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handlePublish = async (template: TemplateListItem) => {
    if (!template.syncId) return;
    setActionLoading(template.templateId);
    try {
      if (!(await ensureAccount())) return;
      await publishLocalTemplate(template.syncId);
      await loadTemplates();
      toast({
        title: template.published ? '게시물 업데이트 완료' : '템플릿 게시 완료',
        description: '커뮤니티에 현재 저장본을 공개했습니다.',
      });
    } catch (error) {
      reportTemplateOperationFailure('Failed to publish template', error);
      toast({
        title: '게시 실패',
        description:
          error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpublish = async (template: TemplateListItem) => {
    if (!template.syncId || !confirm(`“${template.name}” 게시를 내리시겠습니까?`)) {
      return;
    }
    setActionLoading(template.templateId);
    try {
      await unpublishLocalTemplate(template.syncId);
      await loadTemplates();
      toast({ title: '게시를 내렸습니다' });
    } catch (error) {
      reportTemplateOperationFailure('Failed to unpublish template', error);
      toast({
        title: '게시 내리기 실패',
        description:
          error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const backup = await createTemplateBackup();
      downloadJson(
        backup,
        `linku-backup-${backup.exportedAt.slice(0, 10)}.json`,
      );
      toast({
        title: '백업 파일을 저장했습니다',
        description: `템플릿 ${backup.templates.length}개와 아이콘 ${backup.assets.length}개를 담았습니다.`,
      });
    } catch (error) {
      reportTemplateOperationFailure('Failed to export a template backup', error);
      toast({
        title: '백업 실패',
        description:
          error instanceof Error ? error.message : '백업 파일을 만들지 못했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleRestoreBackup = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > MAX_TEMPLATE_BACKUP_BYTES) {
        throw new UserFacingError(
          '백업 파일은 10MB 이하여야 합니다.',
          'TEMPLATE_BACKUP_FILE_TOO_LARGE',
        );
      }
      let parsedBackup: unknown;
      try {
        parsedBackup = JSON.parse(await file.text()) as unknown;
      } catch {
        throw new UserFacingError(
          '백업 파일의 JSON 형식이 올바르지 않습니다.',
          'TEMPLATE_BACKUP_INVALID_JSON',
        );
      }
      const result = await restoreTemplateBackup(
        parsedBackup,
      );
      await loadTemplates();
      window.dispatchEvent(new Event('linku:templates-changed'));
      const hasRestoreWarnings =
        result.skipped > 0 || result.failedAssets > 0;
      toast({
        title: hasRestoreWarnings ? '일부 복원 완료' : '복원 완료',
        description: [
          `템플릿 ${result.imported}개를 복원했습니다.`,
          result.skipped > 0 ? `${result.skipped}개를 건너뛰었습니다.` : '',
          result.failedAssets > 0
            ? `아이콘 ${result.failedAssets}개는 복원하지 못했습니다.`
            : '',
        ].filter(Boolean).join(' '),
        variant: hasRestoreWarnings ? 'destructive' : 'default',
      });
    } catch (error) {
      reportTemplateOperationFailure('Failed to restore a template backup', error);
      toast({
        title: '복원 실패',
        description:
          error instanceof Error ? error.message : '백업을 복원하지 못했습니다.',
        variant: 'destructive',
      });
    } finally {
      if (restoreInputRef.current) restoreInputRef.current.value = '';
    }
  };

  const handleDownloadQuarantined = async () => {
    try {
      const records = await listQuarantinedRecords();
      downloadJson(records, 'linku-damaged-templates.json');
      toast({
        title: '복구용 파일을 저장했습니다',
        description: '원본 데이터를 그대로 담았습니다.',
      });
    } catch (error) {
      captureErrorLog('Failed to export quarantined records', error);
      toast({
        title: '내보내기 실패',
        description: '손상된 데이터를 내보내지 못했습니다.',
        variant: 'destructive',
      });
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
        {visibleTemplates.map((template) => {
          const isStored = template.templateId !== UNSAVED_TEMPLATE_ID;
          const isBusy = actionLoading === template.templateId;
          const syncLabel = {
            error: '동기화 지연',
            local: accountConnected ? '동기화 전' : '이 기기에 저장',
            pending: '동기화 대기',
            synced: '동기화됨',
          }[template.accountSyncStatus];

          return (
            <article key={template.templateId} className="overflow-hidden rounded-lg border">
              <TemplateCard
                template={template}
                className="w-full rounded-none border-0"
                onClick={
                  isStored
                    ? () => navigate(`/editor/${template.templateId}`)
                    : undefined
                }
                isSelected={
                  selectedTemplateId === null
                    ? !isStored
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
                showDelete={isStored}
                isActionLoading={isBusy}
              />

              {isStored && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {template.accountSyncStatus === 'synced' ? (
                      <Cloud className="h-3.5 w-3.5" />
                    ) : (
                      <CloudOff className="h-3.5 w-3.5" />
                    )}
                    <span>{syncLabel}</span>
                    {template.published && (
                      <span className="rounded-full bg-muted px-2 py-0.5">
                        {template.publicationOutdated ? '업데이트 필요' : '게시됨'}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {(!template.published || template.publicationOutdated) && (
                      <Button
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void handlePublish(template)}
                      >
                        {template.published ? '게시물 업데이트' : '게시'}
                      </Button>
                    )}
                    {template.published && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => void handleUnpublish(template)}
                      >
                        게시 내리기
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container mx-auto h-full max-w-7xl overflow-y-auto px-4 py-6">
      <div className="mb-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">내 템플릿</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            먼저 이 기기에 저장하고, 로그인하면 여러 기기와 동기화합니다.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button
            className="min-w-0"
            variant="outline"
            disabled={syncing}
            onClick={() => void handleSync()}
          >
            <RefreshCw className={syncing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            {accountConnected ? '지금 동기화' : '로그인하고 동기화'}
          </Button>
          <Button className="min-w-0" variant="outline" onClick={() => navigate('/gallery')}>
            <Sparkles className="mr-2 h-4 w-4" />둘러보기
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="w-full min-w-0">
                <Plus className="mr-2 h-4 w-4" />새 템플릿
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCreateFromDefault}>
                <LayoutTemplate className="mr-2 h-4 w-4" />기본 템플릿에서 시작
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCreateEmpty}>
                <FileText className="mr-2 h-4 w-4" />빈 템플릿에서 시작
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleDownloadBackup()}>
                <DatabaseBackup className="mr-2 h-4 w-4" />전체 백업 내려받기
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => restoreInputRef.current?.click()}>
                <DatabaseBackup className="mr-2 h-4 w-4" />백업에서 복원
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={restoreInputRef}
            className="hidden"
            type="file"
            accept=".json,application/json"
            onChange={(event) => void handleRestoreBackup(event.target.files?.[0])}
          />
        </div>
      </div>

      {quarantinedCount > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-semibold">
              읽을 수 없는 템플릿 {quarantinedCount}개를 따로 보관했습니다.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              데이터를 지우지 않고 그대로 두었습니다. 파일로 내려받아 두면 나중에
              복구를 시도할 수 있습니다.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleDownloadQuarantined()}
          >
            내려받기
          </Button>
        </div>
      )}

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
