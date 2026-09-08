import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TemplateIconImage } from '@/components/TemplateIconImage';
import { useEditorContext } from '@/hooks/useEditorContext';
import { deleteLocalIcon, renameLocalIcon } from '@/utils/localIcons';
import { MAX_TEMPLATE_NAME_LENGTH } from '@/constants/template';
import { UserFacingError } from '@/errors/userFacingError';
import { captureErrorLog } from '@/utils/logger';
import { recordBreadcrumb } from '@/monitoring';

export function IconManagerDialog({ onClose }: { onClose: () => void }) {
  const { state } = useEditorContext();
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const currentItems = [...(state.template?.items ?? []), ...state.stagingItems];

  const save = async (operation: () => Promise<void>, message: string) => {
    setBusy(true);
    try {
      await operation();
      setEditing(null);
      setDeleting(null);
      toast.success(message, { description: '이 기기에 반영했습니다. 계정 연결 시 다른 기기에도 동기화됩니다.' });
    } catch (error) {
      if (error instanceof UserFacingError) {
        recordBreadcrumb('template.validation', 'icon change rejected', { validation_code: error.code }, 'warning');
      } else {
        captureErrorLog('[Icon manager] Local change failed', error);
      }
      toast.error('아이콘을 변경하지 못했습니다.', {
        description: error instanceof Error ? error.message : '다시 시도해 주세요.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-lg motion-reduce:animate-none">
        <DialogHeader>
          <DialogTitle>내 아이콘 관리</DialogTitle>
          <DialogDescription>
            이름은 이미지 업로드 없이 바꿀 수 있습니다. 템플릿에서 사용하지 않는 아이콘만 삭제할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        {state.userIcons.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">등록한 아이콘이 없습니다. 아이콘 업로드로 추가해 주세요.</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto overscroll-contain" aria-label="내 아이콘" aria-busy={busy}>
            {state.userIcons.map((icon) => {
              const inUse = currentItems.some(({ icon: reference }) => reference.iconId === icon.id || reference.iconUrl === icon.imageUrl);
              return (
                <li key={icon.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <TemplateIconImage src={icon.imageUrl} alt="" width={36} height={36} className="h-9 w-9 shrink-0 object-contain" />
                    <span className="min-w-0 flex-1 break-all text-sm">{icon.name}</span>
                    <Button variant="ghost" size="icon" disabled={busy} aria-label={`${icon.name} 이름 변경`}
                      onClick={() => { setEditing({ id: icon.id, name: icon.name }); setDeleting(null); }}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={busy || inUse} aria-label={`${icon.name} 삭제`}
                      onClick={() => { setDeleting(icon.id); setEditing(null); }}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                  {inUse && <p className="text-xs text-muted-foreground">현재 편집 중인 템플릿에서 사용 중</p>}
                  {editing?.id === icon.id && (
                    <form className="flex flex-wrap gap-2" onSubmit={(event) => {
                      event.preventDefault();
                      if (!busy) void save(() => renameLocalIcon(icon.id, editing.name), '아이콘 이름을 변경했습니다.');
                    }}>
                      <Input aria-label="아이콘 이름" name="icon-name" autoComplete="off" value={editing.name} maxLength={MAX_TEMPLATE_NAME_LENGTH} autoFocus
                        disabled={busy} className="min-w-0 flex-1 basis-40"
                        onChange={(event) => setEditing({ id: icon.id, name: event.target.value })} />
                      <Button type="submit" size="sm" disabled={busy || !editing.name.trim()}>{busy ? '저장 중…' : '이름 저장'}</Button>
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setEditing(null)}>취소</Button>
                    </form>
                  )}
                  {deleting === icon.id && (
                    <div className="space-y-2">
                      <p className="text-sm">아이콘을 삭제할까요? 동기화 후 다른 기기에서도 삭제됩니다.</p>
                      <div className="flex gap-2">
                        <Button variant="destructive" size="sm" disabled={busy || inUse}
                          onClick={() => void save(() => deleteLocalIcon(icon.id), '아이콘 삭제를 저장했습니다.')}>{busy ? '삭제 중…' : '삭제 확인'}</Button>
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => setDeleting(null)}>취소</Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
