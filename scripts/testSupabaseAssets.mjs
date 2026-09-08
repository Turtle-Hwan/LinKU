import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const status = spawnSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json', ...process.argv.slice(2)], { encoding: 'utf8' });
assert.equal(status.status, 0, 'Start the local Supabase stack first.');
const config = JSON.parse(status.stdout);
assert.ok(['localhost', '127.0.0.1'].includes(new URL(config.API_URL).hostname), 'This test only runs against local Supabase.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const accounts = [];
const bytes = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==', 'base64');
const hash = createHash('sha256').update(bytes).digest('hex');
let phase = 'fixture setup';
let diagnostic;
const ok = ({ data, error }) => {
  diagnostic = error ? { code: error.code, status: error.status } : undefined;
  assert.ok(!error, phase);
  return data;
};

try {
  for (let index = 0; index < 2; index++) {
    const email = `linku-asset-test-${randomUUID()}@example.com`;
    const password = randomUUID();
    phase = 'create synthetic local user';
    const { user } = ok(await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      app_metadata: { provider: 'google', providers: ['google'] },
    }));
    // Local-only signed claims exercise RLS without enabling Email or running Google OAuth.
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
      sub: user.id, role: 'authenticated', aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 300,
      app_metadata: { provider: 'google', providers: ['google'] },
    })}`;
    const token = `${unsigned}.${createHmac('sha256', config.JWT_SECRET).update(unsigned).digest('base64url')}`;
    const client = createClient(config.API_URL, config.ANON_KEY, { ...options, accessToken: async () => token });
    accounts.push({ id: user.id, client });
  }
  const [owner, other] = accounts;
  const bucket = owner.client.storage.from('template-assets');
  const path = `${owner.id}/${hash}.webp`;
  phase = 'upload and metadata creation';
  ok(await bucket.upload(path, bytes, { contentType: 'image/webp', upsert: false }));
  const created = ok(await owner.client.rpc('put_asset', { p_content_hash: hash, p_name: '원래 이름' }));
  phase = 'rename without reupload';
  const renamed = ok(await owner.client.rpc('put_asset', { p_content_hash: hash, p_name: '새 이름', p_expected_revision: created.revision }));
  const downloaded = ok(await bucket.download(path));
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
  assert.equal(renamed.name, '새 이름');
  phase = 'cross-account ownership';
  assert.equal(ok(await other.client.from('template_assets').select('*')).length, 0);
  assert.equal((await other.client.rpc('put_asset', { p_content_hash: hash, p_name: '다른 계정', p_expected_revision: renamed.revision })).error?.code, '40001');
  ok(await other.client.storage.from('template-assets').remove([path]));
  ok(await bucket.download(path));
  phase = 'reference and direct-write protection';
  const templateId = randomUUID();
  const document = {
    version: 1, name: '아이콘 참조', height: 1, cloned: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    items: [{ templateItemId: 1, name: '링크', siteUrl: 'https://example.com',
      position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, icon: { kind: 'asset', hash, name: '새 이름' } }], stagingItems: [],
  };
  ok(await owner.client.rpc('put_template', { p_id: templateId, p_document: document, p_content_hash: hash }));
  assert.equal((await owner.client.rpc('delete_asset', { p_content_hash: hash, p_expected_revision: renamed.revision })).error?.message, 'ASSET_IN_USE');
  assert.ok((await owner.client.from('template_assets').delete().eq('content_hash', hash)).error);
  assert.ok((await owner.client.from('template_assets').update({ name: '우회' }).eq('content_hash', hash)).error);
  ok(await bucket.remove([path]));
  ok(await bucket.download(path));
  phase = 'concurrent reference insertion and deletion';
  ok(await owner.client.rpc('put_template', { p_id: templateId, p_document: { ...document, items: [] }, p_content_hash: hash, p_expected_revision: 1 }));
  const [deletion, reference] = await Promise.all([
    owner.client.rpc('delete_asset', { p_content_hash: hash, p_expected_revision: renamed.revision }),
    owner.client.rpc('put_template', { p_id: templateId, p_document: document, p_content_hash: hash, p_expected_revision: 2 }),
  ]);
  assert.ok(deletion.error || reference.error, 'A deleted asset and an active reference must not both commit.');
  if (!reference.error) {
    assert.equal(deletion.error?.message, 'ASSET_IN_USE');
    ok(await owner.client.rpc('delete_template', { p_id: templateId, p_expected_revision: 3 }));
    ok(await owner.client.rpc('delete_asset', { p_content_hash: hash, p_expected_revision: renamed.revision }));
  } else {
    assert.equal(reference.error.message, 'ASSET_NOT_FOUND');
    ok(deletion);
  }
  phase = 'physical file deletion and idempotent retry';
  ok(await bucket.remove([path]));
  assert.ok((await bucket.download(path)).error);
  assert.equal(ok(await owner.client.from('template_assets').select('*')).length, 0);
  ok(await owner.client.rpc('delete_asset', { p_content_hash: hash, p_expected_revision: renamed.revision }));
  ok(await bucket.remove([path]));
  phase = 'stale writes cannot resurrect a deleted or recreated asset';
  assert.equal((await owner.client.rpc('put_asset', { p_content_hash: hash, p_name: '오래된 이름', p_expected_revision: renamed.revision })).error?.code, '40001');
  ok(await bucket.upload(path, bytes, { contentType: 'image/webp' }));
  const recreated = ok(await owner.client.rpc('put_asset', { p_content_hash: hash, p_name: '다시 올림' }));
  assert.ok(recreated.revision > renamed.revision);
  assert.equal((await owner.client.rpc('delete_asset', { p_content_hash: hash, p_expected_revision: renamed.revision })).error?.code, '40001');
  console.log('Local Supabase asset CRUD, ownership, reference race, file deletion and stale-write protection: PASS');
} catch {
  process.exitCode = 1;
  console.error(`Local Supabase asset verification failed: ${phase}`, diagnostic ?? 'assertion');
} finally {
  phase = 'fixture cleanup';
  for (const account of accounts) {
    ok(await admin.storage.from('template-assets').remove([`${account.id}/${hash}.webp`]));
    ok(await admin.auth.admin.deleteUser(account.id));
  }
}
