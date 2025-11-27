/**
 * Template List Page
 * Displays user's owned and cloned templates
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOwnedTemplates, getClonedTemplates, deleteTemplate, getTemplate, syncTemplateToServer } from '@/apis/templates';
import type { TemplateSummary } from '@/types/api';
import { TemplateCard } from '@/components/Editor/EditorSidebar/TemplateCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, FileText, LayoutTemplate } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useSelectedTemplate } from '@/hooks/useSelectedTemplate';
import { updateTemplateSyncStatus, getTemplatesIndex, loadTemplateFromLocalStorage, deleteTemplateFromLocalStorage } from '@/utils/templateStorage';
import { getErrorMessage } from '@/utils/apiErrorHandler';
import { convertLinkListToTemplateItems, convertLucideIconToDataUri } from '@/utils/template';
import { LinkList } from '@/constants/LinkList';

export const TemplateListPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedTemplateId, selectTemplate } = useSelectedTemplate();

  const [ownedTemplates, setOwnedTemplates] = useState<TemplateSummary[]>([]);
  const [clonedTemplates, setClonedTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'owned' | 'cloned'>('owned');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      // 1. 서버에서 템플릿 목록 가져오기 (에러가 발생해도 계속 진행)
      const [ownedRes, clonedRes] = await Promise.allSettled([
        getOwnedTemplates(),
        getClonedTemplates(),
      ]);

      // Extract values from settled promises
      const ownedResult = ownedRes.status === 'fulfilled' ? ownedRes.value : { success: false as const, error: { message: 'Failed to load owned templates' } };
      const clonedResult = clonedRes.status === 'fulfilled' ? clonedRes.value : { success: false as const, error: { message: 'Failed to load cloned templates' } };

      // 2. localStorage에서 템플릿 인덱스 가져오기
      const localIndex = getTemplatesIndex();

      // 3. 서버 템플릿과 localStorage 템플릿 병합
      let mergedOwned: TemplateSummary[] = [];
      if (ownedResult.success && ownedResult.data) {
        // 서버 템플릿의 상세 정보 로드 (items 포함)
        const detailedTemplates = await Promise.all(
          ownedResult.data.map(async (serverTemplate) => {
            try {
              const detailResult = await getTemplate(serverTemplate.templateId);
              if (detailResult.success && detailResult.data) {
                return {
                  ...serverTemplate,
                  syncStatus: 'synced' as const,
                  items: detailResult.data.items, // Add items for preview
                };
              }
            } catch (error) {
              console.error(`Failed to load template ${serverTemplate.templateId}:`, error);
            }
            // Fallback without items
            return {
              ...serverTemplate,
              syncStatus: 'synced' as const,
            };
          })
        );
        mergedOwned = detailedTemplates;
      }

      // 4. localStorage에만 있는 템플릿 추가
      localIndex
        .filter(localTemplate => localTemplate.templateId !== 0) // Skip draft templates (templateId: 0)
        .forEach(localTemplate => {
          // 서버 목록에 없는 템플릿만 추가
          const existsInServer = mergedOwned.some(
            t => t.templateId === localTemplate.templateId
          );

          if (!existsInServer) {
            // localStorage에서 전체 템플릿 데이터 로드
            const stored = loadTemplateFromLocalStorage(localTemplate.templateId);
            if (stored) {
              mergedOwned.push({
                templateId: stored.template.templateId,
                name: stored.template.name,
                height: stored.template.height,
                cloned: stored.template.cloned,
                createdAt: stored.template.createdAt,
                updatedAt: stored.template.updatedAt,
                itemCount: stored.template.items.length,
                syncStatus: stored.metadata.syncedWithServer ? 'synced' : 'local',
                items: stored.template.items, // Add items for preview
              });
            }
          }
        });

      // 5. 중복 검사 및 경고 (Deduplication check)
      const seenIds = new Set<number>();
      const duplicateIds: number[] = [];
      for (const template of mergedOwned) {
        if (seenIds.has(template.templateId)) {
          duplicateIds.push(template.templateId);
        }
        seenIds.add(template.templateId);
      }
      if (duplicateIds.length > 0) {
        console.warn('[TemplateListPage] Duplicate template IDs detected:', duplicateIds);
        // Remove duplicates - keep first occurrence only
        mergedOwned = mergedOwned.filter((template, index, self) =>
          index === self.findIndex(t => t.templateId === template.templateId)
        );
      }

      // 6. 기본 템플릿 추가 (항상 맨 위에 표시)
      // Convert LinkList to Icon array (including lucide-react icons)
      const defaultIcons = LinkList.map((link, index) => {
        let imageUrl: string;

        if (typeof link.icon === 'string') {
          // PNG/URL 문자열
          imageUrl = link.icon;
        } else {
          // LucideIcon 컴포넌트 → 데이터 URI 변환
          imageUrl = convertLucideIconToDataUri(link.icon);
        }

        return {
          id: index,
          name: link.label,
          imageUrl,
        };
      });
      const defaultTemplateItems = convertLinkListToTemplateItems(defaultIcons);
      const defaultTemplate: TemplateSummary = {
        templateId: 0,
        name: 'LinKU 기본 템플릿',
        height: 6,
        cloned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        itemCount: defaultTemplateItems.length,
        syncStatus: 'synced',
        items: defaultTemplateItems,
      };

      // 7. 최종 정렬 (updatedAt 기준 내림차순)
      mergedOwned.sort((a, b) => {
        const aTime = new Date(a.updatedAt).getTime();
        const bTime = new Date(b.updatedAt).getTime();
        return bTime - aTime;
      });

      // 기본 템플릿을 맨 앞에 추가
      setOwnedTemplates([defaultTemplate, ...mergedOwned]);

      // 복제 템플릿도 동일하게 처리 (서버만, 보통 복제는 로컬에 없음)
      if (clonedResult.success && clonedResult.data) {
        const detailedCloned = await Promise.all(
          clonedResult.data.map(async (clonedTemplate) => {
            try {
              const detailResult = await getTemplate(clonedTemplate.templateId);
              if (detailResult.success && detailResult.data) {
                return {
                  ...clonedTemplate,
                  syncStatus: 'synced' as const,
                  items: detailResult.data.items,
                };
              }
            } catch (error) {
              console.error(`Failed to load cloned template ${clonedTemplate.templateId}:`, error);
            }
            return {
              ...clonedTemplate,
              syncStatus: 'synced' as const,
            };
          })
        );
        setClonedTemplates(detailedCloned);
      }

      // 에러 처리 - 에러가 발생해도 localStorage 템플릿은 표시되도록 조용히 처리
      if (!ownedResult.success) {
        console.warn('Failed to load owned templates from server:', ownedResult.error);
        // Don't show error toast - user can still see local templates
      }

      if (!clonedResult.success) {
        console.warn('Failed to load cloned templates from server:', clonedResult.error);
        // Don't show error toast - this is not critical for normal usage
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast({
        title: '네트워크 오류',
        description: '서버와 연결할 수 없습니다. 네트워크 연결을 확인해주세요.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFromDefault = () => {
    navigate('/editor?from=default');
  };

  const handleCreateEmpty = () => {
    navigate('/editor?from=empty');
  };

  const handleEditTemplate = (templateId: number) => {
    navigate(`/editor/${templateId}`);
  };

  const handleApplyTemplate = async (templateId: number, templateName: string) => {
    try {
      // 기본 템플릿(templateId === 0)인 경우 null로 처리
      const targetId = templateId === 0 ? null : templateId;
      await selectTemplate(targetId);

      const message = templateId === 0
        ? '기본 템플릿이 적용되었습니다.'
        : `"${templateName}" 템플릿이 메인 화면에 적용되었습니다.`;

      toast({
        title: '템플릿 적용 완료',
        description: message,
      });
    } catch (error) {
      console.error('Failed to apply template:', error);
      toast({
        title: '적용 실패',
        description: '템플릿 적용에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTemplate = async (
    templateId: number,
    templateName: string,
    syncStatus?: 'local' | 'synced'
  ) => {
    if (!confirm(`"${templateName}" 템플릿을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      // Local-only template: Delete from localStorage only
      if (syncStatus === 'local') {
        deleteTemplateFromLocalStorage(templateId);

        toast({
          title: '삭제 완료',
          description: '로컬 템플릿이 삭제되었습니다.',
        });

        // 목록 갱신
        setOwnedTemplates(prev => prev.filter(t => t.templateId !== templateId));
        setClonedTemplates(prev => prev.filter(t => t.templateId !== templateId));

        // 삭제된 템플릿이 현재 적용 중이라면 선택 해제
        if (selectedTemplateId === templateId) {
          await selectTemplate(null);
        }
        return;
      }

      // Synced template: Delete from server first
      const result = await deleteTemplate(templateId);

      if (result.success) {
        // Also delete from localStorage if exists
        deleteTemplateFromLocalStorage(templateId);

        toast({
          title: '삭제 완료',
          description: '템플릿이 서버와 로컬에서 삭제되었습니다.',
        });

        // 목록 갱신
        setOwnedTemplates(prev => prev.filter(t => t.templateId !== templateId));
        setClonedTemplates(prev => prev.filter(t => t.templateId !== templateId));

        // 삭제된 템플릿이 현재 적용 중이라면 선택 해제
        if (selectedTemplateId === templateId) {
          await selectTemplate(null);
        }
      } else {
        const errorMsg = getErrorMessage(result, '템플릿 삭제에 실패했습니다.');
        toast({
          title: '삭제 실패',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast({
        title: '네트워크 오류',
        description: '서버와 연결할 수 없습니다. 네트워크 연결을 확인해주세요.',
        variant: 'destructive',
      });
    }
  };

  const handleSyncTemplate = async (templateId: number, templateName: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      // Load full template data
      const templateResult = await getTemplate(templateId);
      if (!templateResult.success || !templateResult.data) {
        const errorMsg = getErrorMessage(templateResult, '템플릿을 불러올 수 없습니다.');
        throw new Error(errorMsg);
      }

      // Sync to server
      const syncResult = await syncTemplateToServer(templateResult.data);

      if (syncResult.success && syncResult.data) {
        // Update localStorage sync status
        updateTemplateSyncStatus(syncResult.data.templateId, true);

        // Update local state
        setOwnedTemplates(prev =>
          prev.map(t =>
            t.templateId === templateId
              ? { ...t, syncStatus: 'synced' as const }
              : t
          )
        );

        toast({
          title: '동기화 완료',
          description: `"${templateName}" 템플릿이 서버에 동기화되었습니다.`,
        });
      } else {
        const errorMsg = getErrorMessage(syncResult, '동기화에 실패했습니다.');
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Failed to sync template:', error);
      const description = error instanceof Error
        ? error.message
        : '서버와 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
      toast({
        title: '동기화 실패',
        description,
        variant: 'destructive',
      });
    }
  };

  const renderTemplateList = (templates: TemplateSummary[]) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      );
    }

    if (templates.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <p className="text-muted-foreground">템플릿이 없습니다.</p>
          {activeTab === 'owned' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  새 템플릿 만들기
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem onClick={handleCreateFromDefault}>
                  <LayoutTemplate className="h-4 w-4 mr-2" />
                  기본 템플릿에서 시작하기
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCreateEmpty}>
                  <FileText className="h-4 w-4 mr-2" />
                  빈 템플릿에서 시작하기
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {templates.map((template) => {
          // Ensure only ONE template is selected at a time
          // - If selectedTemplateId is null → default template (0) is selected
          // - If selectedTemplateId has a value → that specific template is selected
          const isSelected = selectedTemplateId === null
            ? template.templateId === 0
            : selectedTemplateId === template.templateId;

          // 디버깅: 선택 상태 로깅
          if (isSelected) {
            console.log('[TemplateListPage] Selected template:', {
              templateId: template.templateId,
              templateName: template.name,
              selectedTemplateId,
              isSelected,
            });
          }

          return (
            <TemplateCard
              key={template.templateId}
              template={template}
              onClick={template.templateId === 0 ? undefined : () => handleEditTemplate(template.templateId)}
              isSelected={isSelected}
              onApply={(e) => {
                e.stopPropagation();
                handleApplyTemplate(template.templateId, template.name);
              }}
              onDelete={(e) => {
                e.stopPropagation();
                handleDeleteTemplate(template.templateId, template.name, template.syncStatus);
              }}
              onSync={(e) => handleSyncTemplate(template.templateId, template.name, e)}
              showDelete={activeTab === 'owned'}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">내 템플릿</h1>
          <p className="text-sm text-muted-foreground mt-1">
            저장된 템플릿을 관리하고 편집하세요
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              새 템플릿
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleCreateFromDefault}>
              <LayoutTemplate className="h-4 w-4 mr-2" />
              기본 템플릿에서 시작하기
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCreateEmpty}>
              <FileText className="h-4 w-4 mr-2" />
              빈 템플릿에서 시작하기
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'owned' | 'cloned')}>
        <TabsList className="mb-4">
          <TabsTrigger value="owned">
            내가 만든 템플릿 ({ownedTemplates.length})
          </TabsTrigger>
          <TabsTrigger value="cloned">
            복제한 템플릿 ({clonedTemplates.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owned">
          {renderTemplateList(ownedTemplates)}
        </TabsContent>

        <TabsContent value="cloned">
          {renderTemplateList(clonedTemplates)}
        </TabsContent>
      </Tabs>
    </div>
  );
};
