import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Download, Sparkles } from 'lucide-react';
import { TemplateCard } from '@/components/Editor/TemplatePreview/TemplateCard';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { createBundledDefaultTemplate } from '@/utils/defaultTemplate';
import { importTemplateCopy } from '@/utils/templateStorage';
import {
  resolveLatestBulletin,
  subscribeLatestBulletin,
} from '@/apis/external/bulletin';
import { captureErrorLog } from '@/utils/logger';

export const GalleryPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [template, setTemplate] = useState(createBundledDefaultTemplate);

  useEffect(() => {
    const applyBulletin = (bulletin: Parameters<typeof createBundledDefaultTemplate>[0]) => {
      setTemplate(createBundledDefaultTemplate(bulletin));
    };
    const unsubscribe = subscribeLatestBulletin(applyBulletin);
    void resolveLatestBulletin().then(applyBulletin);
    return unsubscribe;
  }, []);

  const handleImport = async () => {
    setImporting(true);
    try {
      const stored = await importTemplateCopy(template);
      toast({
        title: '템플릿 추가 완료',
        description: '서버 연결 없이 이 기기에 저장했습니다.',
      });
      navigate(`/editor/${stored.template.templateId}`);
    } catch (error) {
      captureErrorLog('Failed to import bundled template', error);
      toast({
        title: '가져오기 실패',
        description: '브라우저 저장소에 템플릿을 추가하지 못했습니다.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="container mx-auto h-full max-w-5xl overflow-y-auto px-4 py-6">
      <div className="mb-6 flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/templates')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">템플릿 둘러보기</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            커뮤니티가 열리기 전에는 검증된 템플릿을 확장 프로그램에 함께 제공합니다.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <TemplateCard
          template={{ ...template, itemCount: template.items.length }}
        />
        <Button onClick={handleImport} disabled={importing}>
          <Download className="mr-2 h-4 w-4" />
          {importing ? '저장 중...' : '내 템플릿으로 가져오기'}
        </Button>
      </div>
    </div>
  );
};
