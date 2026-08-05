import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  CalendarDays,
  ImageUp,
  LoaderCircle,
} from "lucide-react";
import EverytimeSymbolUrl from "@/assets/everytime_symbol.svg";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TimetableActionButton } from "@/components/Tabs/TimeTable/TimetableActionButton";
import { EverytimeSchedule } from "@/components/Tabs/TimeTable/EverytimeSchedule";
import { TimetableSavedActions } from "@/components/Tabs/TimeTable/TimetableSavedActions";
import { sortTimetableAssetsBySemester } from "@/components/Tabs/TimeTable/timetableAssetSorting";
import { useBlobObjectUrl } from "@/hooks/useBlobObjectUrl";
import { type TimetableBusyState, useTimetable } from "@/hooks/useTimetable";
import { cn } from "@/lib/utils";
import type {
  ResolvedTimetableAsset,
  TimetableAssetMeta,
} from "@/types/timetable";

interface FileInputProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

interface EverytimeImportButtonProps {
  label: string;
  busy: TimetableBusyState;
  disabled: boolean;
  onImport: () => void;
}

interface AcademicInfoImportButtonProps {
  className?: string;
}

interface EmptyProps {
  isDragging: boolean;
  busy: TimetableBusyState;
  onImport: () => void;
  onUpload: () => void;
}

interface SavedProps {
  asset: ResolvedTimetableAsset;
  assets: TimetableAssetMeta[];
  imageUrl: string | null;
  busy: TimetableBusyState;
  onImport: () => void;
  onImportPreviousSemesters: () => void;
  onUpload: () => void;
  onPreview: () => void;
  onDelete: () => void;
  onSelect: (id: string) => void;
}

interface PreviewDialogProps {
  asset: ResolvedTimetableAsset | null;
  imageUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DeleteDialogProps {
  open: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}

const TimeTableRoot = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const {
    asset,
    assets,
    busy,
    saveUploadedFile,
    importLatestEverytime,
    importPreviousEverytimeSemesters,
    deleteTimetable,
    selectTimetable,
  } = useTimetable();
  const imageUrl = useBlobObjectUrl(
    asset?.kind === "upload" ? asset.blob : undefined,
  );

  const saveSelectedFile = useCallback(
    (file: File) => {
      void saveUploadedFile(file).finally(() => {
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      });
    },
    [saveUploadedFile],
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        saveSelectedFile(file);
      }
    },
    [saveSelectedFile],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);

      const file = event.dataTransfer.files[0];
      if (file && !busy) {
        saveSelectedFile(file);
      }
    },
    [busy, saveSelectedFile],
  );

  const handleEverytimeImport = useCallback(() => {
    void importLatestEverytime();
  }, [importLatestEverytime]);

  const handlePreviousSemestersImport = useCallback(() => {
    void importPreviousEverytimeSemesters();
  }, [importPreviousEverytimeSemesters]);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const openPreview = useCallback(() => {
    setIsPreviewOpen(true);
  }, []);

  const openDeleteDialog = useCallback(() => {
    setIsDeleteOpen(true);
  }, []);

  const handleDelete = useCallback(() => {
    void deleteTimetable().then((deleted) => {
      if (deleted) {
        setIsDeleteOpen(false);
      }
    });
  }, [deleteTimetable]);

  return (
    <section
      className="h-[400px] border-t bg-white"
      aria-label="시간표"
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) {
          setIsDragging(false);
        }
      }}
      onDrop={handleDrop}
    >
      <FileInput inputRef={inputRef} onChange={handleFileChange} />

      {busy === "loading" ? (
        <Loading />
      ) : asset ? (
        <Saved
          asset={asset}
          assets={assets}
          imageUrl={imageUrl}
          busy={busy}
          onImport={handleEverytimeImport}
          onImportPreviousSemesters={handlePreviousSemestersImport}
          onUpload={openFilePicker}
          onPreview={openPreview}
          onDelete={openDeleteDialog}
          onSelect={selectTimetable}
        />
      ) : (
        <Empty
          isDragging={isDragging}
          busy={busy}
          onImport={handleEverytimeImport}
          onUpload={openFilePicker}
        />
      )}

      <PreviewDialog
        asset={asset}
        imageUrl={imageUrl}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />
      <DeleteDialog
        open={isDeleteOpen}
        isDeleting={busy === "deleting"}
        onOpenChange={setIsDeleteOpen}
        onDelete={handleDelete}
      />
    </section>
  );
};

const FileInput = ({ inputRef, onChange }: FileInputProps) => (
  <input
    ref={inputRef}
    type="file"
    accept="image/png,.png"
    className="sr-only"
    onChange={onChange}
  />
);

const Loading = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3">
    <LoaderCircle className="size-7 animate-spin text-main" />
    <p className="text-sm leading-[1.5] text-muted-foreground">
      저장된 시간표를 불러오는 중이에요
    </p>
  </div>
);

const EverytimeImportButton = ({
  label,
  busy,
  disabled,
  onImport,
}: EverytimeImportButtonProps) => (
  <TimetableActionButton type="button" disabled={disabled} onClick={onImport}>
    {busy === "importing" ? (
      <LoaderCircle className="animate-spin" />
    ) : (
      <img
        src={EverytimeSymbolUrl}
        alt=""
        aria-hidden="true"
        className="size-5"
      />
    )}
    {label}
  </TimetableActionButton>
);

const AcademicInfoImportButton = ({ className }: AcademicInfoImportButtonProps) => (
  <TimetableActionButton
    type="button"
    className={className}
    disabled
    aria-label="학사정보시스템에서 가져오기 준비 중"
  >
    <CalendarDays />
    학사정보시스템에서 가져오기
  </TimetableActionButton>
);

const Empty = ({
  isDragging,
  busy,
  onImport,
  onUpload,
}: EmptyProps) => {
  const isBusy = busy !== null;

  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center px-8 text-center transition-colors",
        isDragging && "bg-main/5",
      )}
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-main/10 text-main">
        {busy === "uploading" || busy === "importing" ? (
          <LoaderCircle className="size-7 animate-spin" />
        ) : (
          <CalendarDays className="size-7" />
        )}
      </div>
      <h2 className="text-lg font-semibold leading-[1.5]">
        내 시간표를 바로 확인하세요
      </h2>
      <p className="mt-2 max-w-[350px] text-sm leading-[1.65] text-muted-foreground">
        로그인된 에브리타임 탭이 있으면 자동으로 가져옵니다.
      </p>
      <div className="mt-5 flex w-full max-w-[330px] flex-col gap-2">
        <EverytimeImportButton
          label="에브리타임에서 가져오기"
          busy={busy}
          disabled={isBusy}
          onImport={onImport}
        />
        <AcademicInfoImportButton />
        <TimetableActionButton type="button" disabled={isBusy} onClick={onUpload}>
          {busy === "uploading" ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <ImageUp />
          )}
          PNG 파일 올리기
        </TimetableActionButton>
      </div>
      <p className="mt-4 text-sm leading-[1.5] text-muted-foreground">
        이미지는 서버가 아닌 이 브라우저에만 저장됩니다
      </p>
    </div>
  );
};

const Saved = ({
  asset,
  assets,
  imageUrl,
  busy,
  onImport,
  onImportPreviousSemesters,
  onUpload,
  onPreview,
  onDelete,
  onSelect,
}: SavedProps) => {
  const isBusy = busy !== null;
  const isUploadedImage = asset.kind === "upload";
  const sortedAssets = useMemo(
    () => sortTimetableAssetsBySemester(assets),
    [assets],
  );

  return (
    <div
      className={cn(
        "flex h-full flex-col",
        isUploadedImage ? "gap-0 bg-white p-0" : "gap-2 p-2",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2",
          isUploadedImage && "p-2",
        )}
      >
        {assets.length > 1 ? (
          <label className="min-w-0 flex-1">
            <span className="sr-only">저장된 시간표 선택</span>
            <select
              className="h-8 w-full min-w-0 rounded-md border border-neutral-300 bg-white px-2 text-sm font-semibold text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-main/50"
              value={asset.meta.id}
              aria-label="저장된 시간표 선택"
              disabled={isBusy}
              onChange={(event) => onSelect(event.target.value)}
            >
              {sortedAssets.map((storedAsset) => (
                <option key={storedAsset.id} value={storedAsset.id}>
                  {storedAsset.semester ?? "PNG 시간표"}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold leading-[1.5]">
            {asset.meta.semester ?? "내 시간표"}
          </h2>
        )}

        <TimetableSavedActions
          busy={busy}
          source={asset.meta.source}
          onImport={onImport}
          onImportPreviousSemesters={onImportPreviousSemesters}
          onUpload={onUpload}
          onDelete={onDelete}
        />
      </div>

      {asset.kind === "everytime" ? (
        <EverytimeSchedule timetable={asset.timetable} />
      ) : imageUrl ? (
        <button
          type="button"
          className="m-0 min-h-0 flex-1 overflow-hidden border-0 bg-white p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-main/50"
          onClick={onPreview}
          aria-label="시간표 크게 보기"
        >
          <img
            src={imageUrl}
            alt="업로드한 시간표"
            className="m-0 block size-full object-contain"
          />
        </button>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border bg-neutral-50 px-6 text-center text-sm leading-[1.5] text-muted-foreground">
          업로드한 시간표 이미지를 불러오지 못했습니다.
        </div>
      )}
    </div>
  );
};

const PreviewDialog = ({
  asset,
  imageUrl,
  open,
  onOpenChange,
}: PreviewDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[560px] max-w-[468px] p-4">
      <DialogHeader>
        <DialogTitle>{asset?.meta.semester ?? "내 시간표"}</DialogTitle>
        <DialogDescription>
          저장된 원본 비율로 시간표를 확인할 수 있어요.
        </DialogDescription>
      </DialogHeader>
      {imageUrl && (
        <div className="max-h-[450px] overflow-auto bg-white">
          <img
            src={imageUrl}
            alt="확대된 내 시간표"
            className="m-0 block h-auto w-full"
          />
        </div>
      )}
    </DialogContent>
  </Dialog>
);

const DeleteDialog = ({
  open,
  isDeleting,
  onOpenChange,
  onDelete,
}: DeleteDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-[420px]">
      <DialogHeader>
        <DialogTitle>저장된 시간표를 삭제할까요?</DialogTitle>
        <DialogDescription>
          현재 보고 있는 시간표만 삭제합니다. 다른 시간표는 그대로 유지됩니다.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={isDeleting}>
            취소
          </Button>
        </DialogClose>
        <Button
          type="button"
          variant="destructive"
          disabled={isDeleting}
          onClick={onDelete}
        >
          {isDeleting && <LoaderCircle className="animate-spin" />}
          삭제
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const TimeTable = Object.assign(React.memo(TimeTableRoot), {
  FileInput: React.memo(FileInput),
  Loading: React.memo(Loading),
  EverytimeImportButton: React.memo(EverytimeImportButton),
  AcademicInfoImportButton: React.memo(AcademicInfoImportButton),
  Empty: React.memo(Empty),
  Saved: React.memo(Saved),
  EverytimeSchedule,
  SavedActions: TimetableSavedActions,
  PreviewDialog: React.memo(PreviewDialog),
  DeleteDialog: React.memo(DeleteDialog),
});

export default TimeTable;
