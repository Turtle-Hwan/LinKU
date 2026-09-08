export function assertPublicSupabaseKey(key: string | undefined): void {
  if (!key || /^sb_publishable_[A-Za-z0-9_-]+$/u.test(key)) return;
  try {
    const parts = key.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1].replace(/-/gu, '+').replace(/_/gu, '/'))) as { role?: unknown };
      if (payload.role === 'anon') return;
    }
  } catch {
    // Invalid input is rejected below without including the key in the error.
  }
  throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY에는 공개 publishable 또는 anon 키만 사용할 수 있습니다.');
}
