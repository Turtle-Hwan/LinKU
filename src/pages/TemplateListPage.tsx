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
import { Plus, Trash2, Check, CloudUpload, Cloud } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useSelectedTemplate } from '@/hooks/useSelectedTemplate';
import { updateTemplateSyncStatus, getTemplatesIndex, loadTemplateFromLocalStorage } from '@/utils/templateStorage';
import { getErrorMessage } from '@/utils/apiErrorHandler';
import { convertLinkListToTemplateItems } from '@/utils/template';
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
      // 1. 서버에서 템플릿 목록 가져오기
      const [ownedRes, clonedRes] = await Promise.all([
        getOwnedTemplates(),
        getClonedTemplates(),
      ]);

      // 2. localStorage에서 템플릿 인덱스 가져오기
      const localIndex = getTemplatesIndex();

      // 3. 서버 템플릿과 localStorage 템플릿 병합
      let mergedOwned: TemplateSummary[] = [];
      if (ownedRes.success && ownedRes.data) {
        // 서버 템플릿의 상세 정보 로드 (items 포함)
        const detailedTemplates = await Promise.all(
          ownedRes.data.map(async (serverTemplate) => {
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
      localIndex.forEach(localTemplate => {
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

      // 5. 기본 템플릿 추가 (항상 맨 위에 표시)
      // Convert LinkList to Icon array first (filter string icons only)
      const defaultIcons = LinkList
        .filter((link) => typeof link.icon === 'string')
        .map((link, index) => ({
          id: index,
          name: link.label,
          imageUrl: link.icon as string,
        }));
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

      // 6. 최종 정렬 (updatedAt 기준 내림차순)
      mergedOwned.sort((a, b) => {
        const aTime = new Date(a.updatedAt).getTime();
        const bTime = new Date(b.updatedAt).getTime();
        return bTime - aTime;
      });

      // 기본 템플릿을 맨 앞에 추가
      setOwnedTemplates([defaultTemplate, ...mergedOwned]);

      // 복제 템플릿도 동일하게 처리 (서버만, 보통 복제는 로컬에 없음)
      if (clonedRes.success && clonedRes.data) {
        const detailedCloned = await Promise.all(
          clonedRes.data.map(async (clonedTemplate) => {
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

      // 에러 처리
      if (!ownedRes.success) {
        console.error('Failed to load owned templates:', ownedRes.error);
        toast({
          title: '내 템플릿 불러오기 실패',
          description: getErrorMessage(ownedRes, '내 템플릿을 불러오는데 실패했습니다.'),
          variant: 'destructive',
        });
      }

      if (!clonedRes.success) {
        console.error('Failed to load cloned templates:', clonedRes.error);
        toast({
          title: '복제 템플릿 불러오기 실패',
          description: getErrorMessage(clonedRes, '복제한 템플릿을 불러오는데 실패했습니다.'),
          variant: 'destructive',
        });
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

  const handleCreateNew = () => {
    navigate('/editor');
  };

  const handleEditTemplate = (templateId: number) => {
    navigate(`/editor/${templateId}`);
  };

  const handleApplyTemplate = async (templateId: number, templateName: string) => {
    try {
      await selectTemplate(templateId);

      toast({
        title: '템플릿 적용 완료',
        description: `"${templateName}" 템플릿이 메인 화면에 적용되었습니다.`,
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

  const handleDeleteTemplate = async (templateId: number, templateName: string) => {
    if (!confirm(`"${templateName}" 템플릿을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const result = await deleteTemplate(templateId);

      if (result.success) {
        toast({
          title: '삭제 완료',
          description: '템플릿이 삭제되었습니다.',
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
            <Button onClick={handleCreateNew} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              새 템플릿 만들기
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const isSelected = selectedTemplateId === template.templateId;

          return (
            <div key={template.templateId} className="relative group">
              <div className={isSelected ? 'ring-2 ring-primary rounded-lg' : ''}>
                <TemplateCard
                  template={template}
                  onClick={template.templateId === 0 ? undefined : () => handleEditTemplate(template.templateId)}
                />
              </div>

              {/* Action buttons */}
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Sync button (local-only templates) - hide for default template */}
                {template.templateId !== 0 && template.syncStatus === 'local' ? (
                  <button
                    onClick={(e) => handleSyncTemplate(template.templateId, template.name, e)}
                    className="p-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700"
                    title="서버에 동기화"
                  >
                    <CloudUpload className="h-4 w-4" />
                  </button>
                ) : template.templateId !== 0 && template.syncStatus === 'synced' ? (
                  <div className="p-2 bg-green-600 text-white rounded-md shadow-sm" title="동기화됨">
                    <Cloud className="h-4 w-4" />
                  </div>
                ) : null}

                {/* Apply button */}
                {!isSelected ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyTemplate(template.templateId, template.name);
                    }}
                    className="p-2 bg-primary text-primary-foreground rounded-md shadow-sm hover:bg-primary/90"
                    title="메인 화면에 적용"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="p-2 bg-primary text-primary-foreground rounded-md shadow-sm">
                    <Check className="h-4 w-4" />
                  </div>
                )}

                {/* Delete button (owned only) - hide for default template */}
                {activeTab === 'owned' && template.templateId !== 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(template.templateId, template.name);
                    }}
                    className="p-2 bg-destructive text-destructive-foreground rounded-md shadow-sm hover:bg-destructive/90"
                    title="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-primary text-primary-foreground text-xs rounded-md">
                  현재 적용 중
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">내 템플릿</h1>
          <p className="text-sm text-muted-foreground mt-1">
            저장된 템플릿을 관리하고 편집하세요
          </p>
        </div>

        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          새 템플릿
        </Button>
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
