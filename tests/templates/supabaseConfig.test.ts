import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPublicSupabaseKey } from '../../src/apis/supabase/config.ts';

const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.synthetic`;

test('Supabase 프론트 설정은 공개 키만 허용하고 오류에 입력값을 남기지 않는다', () => {
  for (const key of [undefined, '', 'sb_publishable_test_only', jwt('anon')]) {
    assert.doesNotThrow(() => assertPublicSupabaseKey(key));
  }
  for (const key of ['sb_secret_test_only', jwt('service_role'), jwt('authenticated'), 'not-a-public-key']) {
    assert.throws(() => assertPublicSupabaseKey(key), (error: unknown) =>
      error instanceof Error && !error.message.includes(key));
  }
});
