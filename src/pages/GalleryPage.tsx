import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Copy,
  Download,
  Heart,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { TemplateCard } from "@/components/Editor/TemplatePreview/TemplateCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { createBundledDefaultTemplate } from "@/utils/defaultTemplate";
import { importTemplateCopy } from "@/storage/templates/repository";
import {
  browsePublications,
  clonePublication,
  createPublicationPreview,
  setPublicationLiked,
} from "@/apis/supabase/community";
import {
  SupabaseConfigurationError,
  isSupabaseConfigured,
} from "@/apis/supabase/client";
import type {
  PublicationSort,
  TemplatePublication,
} from "@/types/account";
import type { Template } from "@/types/api";
import { isLoggedIn, startGoogleLogin } from "@/utils/oauth";
import { captureErrorLog } from "@/utils/logger";
import { isExpectedNetworkFailure } from "@/utils/networkFailure";
import { recordBreadcrumb } from "@/monitoring";
import { UserFacingError } from "@/errors/userFacingError";

const PAGE_SIZE = 12;
const MAX_SEARCH_LENGTH = 80;

function reportCommunityFailure(message: string, error: unknown) {
  if (
    error instanceof UserFacingError ||
    error instanceof SupabaseConfigurationError ||
    isExpectedNetworkFailure(error)
  ) {
    recordBreadcrumb(
      "community.gallery",
      message,
      {
        reason:
          error instanceof UserFacingError
            ? error.code
            : error instanceof SupabaseConfigurationError
              ? "not_configured"
              : "network",
      },
      "warning",
    );
    return;
  }
  captureErrorLog(message, error);
}

function PublicationCard({
  publication,
  preview,
  busy,
  onClone,
  onLike,
}: {
  publication: TemplatePublication;
  preview: Template;
  busy: boolean;
  onClone: () => void;
  onLike: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <TemplateCard
        template={{
          ...preview,
          itemCount: preview.items.length,
        }}
        className="w-full rounded-none border-0"
      />
      <div className="space-y-3 border-t p-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="truncate text-muted-foreground">
            {publication.authorNickname}
          </span>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              {publication.likeCount}
            </span>
            <span className="flex items-center gap-1">
              <Copy className="h-3.5 w-3.5" />
              {publication.cloneCount}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onLike} disabled={busy}>
            <Heart
              className={publication.isLiked ? "fill-current" : undefined}
            />
            {publication.isLiked ? "좋아요 취소" : "좋아요"}
          </Button>
          <Button onClick={onClone} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            내 템플릿으로 복제
          </Button>
        </div>
      </div>
    </article>
  );
}

export const GalleryPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PublicationSort>("latest");
  const [publications, setPublications] = useState<TemplatePublication[]>([]);
  const [previews, setPreviews] = useState<Record<string, Template>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [communityUnavailable, setCommunityUnavailable] = useState(
    !isSupabaseConfigured(),
  );
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);
  const bundledTemplate = useMemo(() => createBundledDefaultTemplate(), []);
  const loadRequestIdRef = useRef(0);

  const load = useCallback(
    async (offset = 0) => {
      const requestId = ++loadRequestIdRef.current;
      if (!isSupabaseConfigured()) {
        setCommunityUnavailable(true);
        setLoading(false);
        return;
      }
      if (offset === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const next = await browsePublications({
          query,
          sort,
          offset,
          limit: PAGE_SIZE,
        });
        const nextPreviews = await Promise.all(
          next.map(async (publication) => [
            publication.templateId,
            await createPublicationPreview(publication),
          ] as const),
        );
        if (requestId !== loadRequestIdRef.current) return;
        setPublications((current) => (offset === 0 ? next : [...current, ...next]));
        setPreviews((current) => ({
          ...(offset === 0 ? {} : current),
          ...Object.fromEntries(nextPreviews),
        }));
        setHasMore(next.length === PAGE_SIZE);
        setCommunityUnavailable(false);
      } catch (error) {
        if (requestId !== loadRequestIdRef.current) return;
        if (offset === 0) {
          setCommunityUnavailable(true);
          setPublications([]);
          setPreviews({});
        } else {
          toast({
            title: "더 불러오지 못했습니다",
            description: "잠시 후 다시 시도해 주세요.",
            variant: "destructive",
          });
        }
        reportCommunityFailure("community gallery unavailable", error);
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [query, sort, toast],
  );

  useEffect(() => {
    void load();
    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [load]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(queryInput.trim());
  };

  const handleClone = async (publication: TemplatePublication) => {
    setBusyTemplateId(publication.templateId);
    try {
      const templateId = await clonePublication(publication);
      toast({
        title: "템플릿 복제 완료",
        description: "이 기기에 독립적인 복사본으로 저장했습니다.",
      });
      navigate(`/editor/${templateId}`);
    } catch (error) {
      reportCommunityFailure("[Gallery] Failed to clone publication", error);
      toast({
        title: "복제 실패",
        description: error instanceof Error ? error.message : "템플릿을 저장하지 못했습니다.",
        variant: "destructive",
      });
    } finally {
      setBusyTemplateId(null);
    }
  };

  const handleLike = async (publication: TemplatePublication) => {
    setBusyTemplateId(publication.templateId);
    try {
      if (!(await isLoggedIn())) {
        const login = await startGoogleLogin();
        if (!login.success) {
          toast({ title: "Google 로그인 필요", description: login.error });
          return;
        }
      }
      const liked = !publication.isLiked;
      const likeCount = await setPublicationLiked(publication.templateId, liked);
      setPublications((current) =>
        current.map((item) =>
          item.templateId === publication.templateId
            ? { ...item, isLiked: liked, likeCount }
            : item,
        ),
      );
    } catch (error) {
      reportCommunityFailure("[Gallery] Failed to update like", error);
      toast({
        title: "좋아요 저장 실패",
        description: "잠시 후 다시 시도해 주세요.",
        variant: "destructive",
      });
    } finally {
      setBusyTemplateId(null);
    }
  };

  const handleBundledImport = async () => {
    try {
      const stored = await importTemplateCopy(bundledTemplate);
      navigate(`/editor/${stored.template.templateId}`);
    } catch (error) {
      captureErrorLog("[Gallery] Failed to import bundled template", error);
      toast({
        title: "가져오기 실패",
        description: "브라우저 저장소에 템플릿을 추가하지 못했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <main className="mx-auto min-h-full w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/templates")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">템플릿 둘러보기</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            게시된 템플릿을 익명으로 둘러보고 내 복사본으로 저장하세요.
          </p>
        </div>
      </header>

      <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex max-w-lg flex-1 gap-2">
          <Input
            value={queryInput}
            maxLength={MAX_SEARCH_LENGTH}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="템플릿 이름이나 작성자 검색"
            aria-label="템플릿 검색"
          />
          <Button type="submit" variant="outline">
            <Search />
            검색
          </Button>
        </form>
        <div className="flex gap-1 rounded-lg border p-1">
          {([
            ["latest", "최신순"],
            ["likes", "좋아요순"],
            ["clones", "복제순"],
          ] as const).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={sort === value ? "secondary" : "ghost"}
              onClick={() => setSort(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </section>

      {communityUnavailable && publications.length === 0 && (
        <div className="mb-6 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          커뮤니티에 연결할 수 없어 함께 제공되는 기본 템플릿을 표시합니다.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : publications.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {publications.map((publication) => {
            const preview = previews[publication.templateId];
            return preview ? (
              <PublicationCard
                key={publication.templateId}
                publication={publication}
                preview={preview}
                busy={busyTemplateId === publication.templateId}
                onClone={() => void handleClone(publication)}
                onLike={() => void handleLike(publication)}
              />
            ) : null;
          })}
        </div>
      ) : !communityUnavailable ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {query ? "검색 결과가 없습니다." : "아직 게시된 템플릿이 없습니다."}
        </div>
      ) : null}

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            disabled={loadingMore}
            onClick={() => void load(publications.length)}
          >
            {loadingMore && <Loader2 className="animate-spin" />}
            더 보기
          </Button>
        </div>
      )}

      {communityUnavailable && publications.length === 0 && (
        <section className="mt-6 max-w-[500px] space-y-3">
          <TemplateCard
            template={{ ...bundledTemplate, itemCount: bundledTemplate.items.length }}
            className="w-full"
          />
          <Button onClick={() => void handleBundledImport()}>
            <Download />
            기본 템플릿 가져오기
          </Button>
        </section>
      )}
    </main>
  );
};
