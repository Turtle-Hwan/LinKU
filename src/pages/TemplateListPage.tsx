/**
 * Template List Page
 * Displays user's owned and cloned templates
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOwnedTemplates, getClonedTemplates, deleteTemplate } from '@/apis/templates';
import type { TemplateSummary } from '@/types/api';
import { TemplateCard } from '@/components/Editor/EditorSidebar/TemplateCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useSelectedTemplate } from '@/hooks/useSelectedTemplate';

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
      const [ownedRes, clonedRes] = await Promise.all([
        getOwnedTemplates(),
        getClonedTemplates(),
      ]);

      if (ownedRes.success && ownedRes.data) {
        setOwnedTemplates(ownedRes.data);
      }

      if (clonedRes.success && clonedRes.data) {
        setClonedTemplates(clonedRes.data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast({
        title: '오류',
        description: '템플릿을 불러오는데 실패했습니다.',
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
        toast({
          title: '삭제 실패',
          description: result.error?.message || '템플릿 삭제에 실패했습니다.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast({
        title: '오류',
        description: '템플릿 삭제 중 오류가 발생했습니다.',
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
                  onClick={() => handleEditTemplate(template.templateId)}
                />
              </div>

              {/* Action buttons */}
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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

                {/* Delete button (owned only) */}
                {activeTab === 'owned' && (
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
