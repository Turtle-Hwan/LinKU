/**
 * Gallery Page - Public template gallery with infinite scroll
 * Browse, search, and clone posted templates
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPublicPostedTemplates, getPostedTemplateDetail, clonePostedTemplate, likePostedTemplate } from '@/apis/posted-templates';
import type { PostedTemplateSummary, PostedTemplateListParams } from '@/types/api';
import { PostedTemplateCard } from '@/components/Editor/TemplatePreview/PostedTemplateCard';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowLeft, Search, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { isLoggedIn } from '@/utils/oauth';

type SortOption = 'newest' | 'oldest' | 'most-liked' | 'most-used';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: '최신순' },
  { value: 'most-liked', label: '좋아요순' },
  { value: 'most-used', label: '복제순' },
  { value: 'oldest', label: '오래된순' },
];

const PAGE_SIZE = 12;

export const GalleryPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // State
  const [templates, setTemplates] = useState<PostedTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Refs
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check login status
  useEffect(() => {
    const checkAuth = async () => {
      const loggedIn = await isLoggedIn();
      setUserLoggedIn(loggedIn);
    };
    checkAuth();

    // Listen for auth changes
    const handleAuthChange = async () => {
      const loggedIn = await isLoggedIn();
      setUserLoggedIn(loggedIn);
    };

    window.addEventListener('auth:logout', handleAuthChange);
    return () => window.removeEventListener('auth:logout', handleAuthChange);
  }, []);

  // Debounce search query
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Load templates
  const loadTemplates = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params: PostedTemplateListParams = {
        sort,
        page: pageNum,
        limit: PAGE_SIZE,
      };

      if (debouncedQuery.trim()) {
        params.query = debouncedQuery.trim();
      }

      const result = await getPublicPostedTemplates(params);

      if (result.success && result.data) {
        const newTemplates = result.data;

        // 각 템플릿의 상세 items 로드 (미리보기용)
        const templatesWithItems = await Promise.all(
          newTemplates.map(async (template) => {
            const detailResult = await getPostedTemplateDetail(template.postedTemplateId);
            return {
              ...template,
              detailItems: detailResult.success ? detailResult.data?.items : undefined,
            };
          })
        );

        if (reset) {
          setTemplates(templatesWithItems);
        } else {
          setTemplates(prev => [...prev, ...templatesWithItems]);
        }

        // Check if there are more pages
        setHasMore(newTemplates.length === PAGE_SIZE);
        setPage(pageNum);
      } else {
        console.error('Failed to load templates:', result.error);
        if (reset) {
          setTemplates([]);
        }
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast({
        title: '로드 실패',
        description: '템플릿을 불러오는데 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sort, debouncedQuery, toast]);

  // Initial load and when filters change
  useEffect(() => {
    setPage(1);
    loadTemplates(1, true);
  }, [sort, debouncedQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll observer
  useEffect(() => {
    if (loading) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadTemplates(page + 1, false);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, hasMore, loadingMore, page, loadTemplates]);

  // Handle clone
  const handleClone = async (template: PostedTemplateSummary) => {
    if (!userLoggedIn) {
      toast({
        title: '로그인 필요',
        description: '템플릿을 복제하려면 로그인이 필요합니다.',
        variant: 'destructive',
      });
      return;
    }

    setActionLoading(template.postedTemplateId);

    try {
      const result = await clonePostedTemplate(template.postedTemplateId);

      if (result.success) {
        // Update clone count locally
        setTemplates(prev =>
          prev.map(t =>
            t.postedTemplateId === template.postedTemplateId
              ? { ...t, usageCount: t.usageCount + 1 }
              : t
          )
        );

        toast({
          title: '복제 완료',
          description: `"${template.name}" 템플릿이 내 템플릿에 추가되었습니다.`,
        });
      } else {
        throw new Error(result.error?.message || '복제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to clone template:', error);
      toast({
        title: '복제 실패',
        description: error instanceof Error ? error.message : '템플릿 복제에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle like
  const handleLike = async (template: PostedTemplateSummary) => {
    if (!userLoggedIn) {
      toast({
        title: '로그인 필요',
        description: '좋아요를 하려면 로그인이 필요합니다.',
        variant: 'destructive',
      });
      return;
    }

    setActionLoading(template.postedTemplateId);

    try {
      const result = await likePostedTemplate(template.postedTemplateId);

      if (result.success && result.data) {
        // Update like state locally
        setTemplates(prev =>
          prev.map(t =>
            t.postedTemplateId === template.postedTemplateId
              ? { ...t, isLiked: result.data!.isLiked, likesCount: result.data!.likeCount }
              : t
          )
        );
      } else {
        throw new Error(result.error?.message || '좋아요 처리에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to like template:', error);
      toast({
        title: '좋아요 실패',
        description: error instanceof Error ? error.message : '좋아요 처리에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">템플릿 갤러리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            다른 사용자들이 공유한 템플릿을 찾아보세요
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="템플릿 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-[120px] shrink-0 justify-between">
              {SORT_OPTIONS.find(o => o.value === sort)?.label || '정렬'}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setSort(option.value)}
                className={sort === option.value ? 'bg-accent' : ''}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-2">
          <p className="text-muted-foreground">
            {debouncedQuery ? '검색 결과가 없습니다.' : '아직 공유된 템플릿이 없습니다.'}
          </p>
          {debouncedQuery && (
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
              검색 초기화
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {templates.map((template) => (
            <PostedTemplateCard
              key={template.postedTemplateId}
              template={template}
              items={template.detailItems}
              height={template.height}
              isLoggedIn={userLoggedIn}
              isLoading={actionLoading === template.postedTemplateId}
              onClone={() => handleClone(template)}
              onLike={() => handleLike(template)}
            />
          ))}
        </div>
      )}

      {/* Load More Trigger */}
      {!loading && hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
        </div>
      )}

      {/* End of List */}
      {!loading && !hasMore && templates.length > 0 && (
        <div className="flex justify-center py-8">
          <p className="text-sm text-muted-foreground">모든 템플릿을 불러왔습니다.</p>
        </div>
      )}
    </div>
  );
};
