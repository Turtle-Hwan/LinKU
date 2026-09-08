begin;
-- Test-only Storage API context; all synthetic rows roll back below.
set local storage.allow_delete_query = 'true';
create extension if not exists pgtap with schema extensions;
select no_plan();

select hasnt_column('public', 'template_assets', 'object_path', 'asset paths are derived');
select hasnt_column('public', 'template_assets', 'byte_size', 'Storage owns byte limits');
select results_eq(
  $$select id, file_size_limit::integer, allowed_mime_types from storage.buckets
    where id in ('template-assets', 'published-template-assets') order by id$$,
  $$values ('published-template-assets'::text, 524288, array['image/webp']::text[]),
           ('template-assets'::text, 524288, array['image/webp']::text[])$$,
  'Storage restricts both buckets to WebP up to 512 KiB'
);

insert into auth.users (id, raw_app_meta_data) values
  ('55555555-5555-4555-8555-555555555555', '{"provider":"google"}'),
  ('66666666-6666-4666-8666-666666666666', '{"provider":"google"}'),
  ('77777777-7777-4777-8777-777777777777', '{"provider":"email"}');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","app_metadata":{"provider":"google"}}', true);

select throws_ok($$select public.put_asset(repeat('a', 64), '아이콘')$$,
  'P0002', 'ASSET_NOT_FOUND', 'metadata requires an uploaded private file');
select throws_ok($$select public.put_asset('../invalid', '아이콘')$$,
  '22023', 'INVALID_ASSET', 'invalid hashes cannot become paths');
select throws_ok($$select public.put_asset(repeat('a', 64), ' ')$$,
  '22023', 'INVALID_ASSET', 'empty names are rejected on the server');
insert into storage.objects (bucket_id, name, owner_id) values
  ('template-assets', '55555555-5555-4555-8555-555555555555/' || repeat('a', 64) || '.webp',
   '55555555-5555-4555-8555-555555555555');
select lives_ok($$select public.put_asset(repeat('a', 64), '아이콘')$$, 'create asset through guarded RPC');
select set_config('test.asset_revision', (select revision::text from public.template_assets), true);
select throws_ok($$insert into public.template_assets (content_hash, name) values (repeat('b', 64), '우회')$$,
  '42501', null, 'direct inserts cannot bypass ownership, quota or revision checks');
select throws_ok($$update public.template_assets set name = '우회'$$,
  '42501', null, 'direct updates cannot bypass revision checks');
select throws_ok($$delete from public.template_assets$$,
  '42501', null, 'direct deletes cannot bypass reference checks');

select lives_ok($$select public.put_asset(repeat('a', 64), '새 이름', current_setting('test.asset_revision')::bigint)$$,
  'rename requires no new file upload');
select is((select name from public.template_assets), '새 이름', 'renamed metadata is visible to the account');
select is((select count(*)::integer from storage.objects where bucket_id = 'template-assets'), 1,
  'rename leaves the original file intact');
select throws_ok($$select public.put_asset(repeat('a', 64), '오래된 이름', current_setting('test.asset_revision')::bigint)$$,
  '40001', 'LINKU_CONFLICT', 'stale-device rename is rejected');
select set_config('test.asset_revision', (select revision::text from public.template_assets), true);
with removed as (delete from storage.objects where bucket_id = 'template-assets' returning id)
select is((select count(*)::integer from removed), 0, 'Storage cannot remove a registered file directly');
with changed as (update storage.objects set metadata = '{}' where bucket_id = 'template-assets' returning id)
select is((select count(*)::integer from changed), 0, 'content-addressed private files cannot be overwritten');

select lives_ok($$select public.put_template('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  jsonb_build_object('version', 1, 'name', '사용 중', 'height', 1, 'cloned', false,
    'createdAt', '2026-09-08T00:00:00.000Z', 'updatedAt', '2026-09-08T00:00:00.000Z',
    'items', '[]'::jsonb, 'stagingItems', jsonb_build_array(jsonb_build_object(
      'templateItemId', 1, 'name', '링크', 'siteUrl', 'https://example.com',
      'position', jsonb_build_object('x', 0, 'y', 0), 'size', jsonb_build_object('width', 1, 'height', 1),
      'icon', jsonb_build_object('kind', 'asset', 'hash', repeat('a', 64), 'name', '새 이름')))), repeat('b', 64))$$,
  'template can reference a registered asset in staging');
select throws_ok($$select public.delete_asset(repeat('a', 64), current_setting('test.asset_revision')::bigint)$$,
  '55000', 'ASSET_IN_USE', 'staging references block deletion');

select set_config('request.jwt.claims',
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated","app_metadata":{"provider":"google"}}', true);
select is((select count(*)::integer from public.template_assets), 0, 'another account cannot read asset metadata');
select throws_ok($$select public.put_asset(repeat('a', 64), '도용', current_setting('test.asset_revision')::bigint)$$,
  '40001', 'LINKU_CONFLICT', 'another account cannot rename an asset');
select lives_ok($$select public.delete_asset(repeat('a', 64), current_setting('test.asset_revision')::bigint)$$,
  'delete is idempotent and reveals no other-account record');
with removed as (delete from storage.objects where bucket_id = 'template-assets' returning id)
select is((select count(*)::integer from removed), 0, 'another account cannot remove private files');

select set_config('request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","app_metadata":{"provider":"google"}}', true);
select is((select count(*)::integer from public.template_assets), 1, 'cross-account delete did not touch the owner record');
select public.delete_template('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1);
select lives_ok($$select public.delete_asset(repeat('a', 64), current_setting('test.asset_revision')::bigint)$$,
  'unused asset metadata is physically deleted');
select is((select count(*)::integer from public.template_assets), 0, 'no server tombstone table or retained name is needed');
select lives_ok($$select public.delete_asset(repeat('a', 64), current_setting('test.asset_revision')::bigint)$$,
  'retry after metadata deletion is safe');
select throws_ok($$select public.put_asset(repeat('a', 64), '부활', current_setting('test.asset_revision')::bigint)$$,
  '40001', 'LINKU_CONFLICT', 'a stale rename cannot recreate deleted metadata');
select throws_ok($$select public.put_template('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  (select document from public.templates where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), repeat('b', 64), 2)$$,
  'P0002', 'ASSET_NOT_FOUND', 'a stale template cannot reference a deleted icon');
select lives_ok($$select public.put_asset(repeat('a', 64), '다시 업로드')$$,
  'an explicit new creation can reuse the same image');
select throws_ok($$select public.delete_asset(repeat('a', 64), current_setting('test.asset_revision')::bigint)$$,
  '40001', 'LINKU_CONFLICT', 'recreation does not reuse the old revision');
select public.delete_asset(repeat('a', 64), (select revision from public.template_assets));
with removed as (delete from storage.objects where bucket_id = 'template-assets' returning id)
select is((select count(*)::integer from removed), 1, 'Storage permits cleanup only after metadata deletion');

reset role;
insert into public.template_assets (owner_id, content_hash, name)
select '55555555-5555-4555-8555-555555555555', lpad(sequence::text, 64, '0'), '아이콘'
from generate_series(1, 100) sequence;
insert into storage.objects (bucket_id, name, owner_id) values
  ('template-assets', '55555555-5555-4555-8555-555555555555/' || repeat('c', 64) || '.webp',
   '55555555-5555-4555-8555-555555555555');
set local role authenticated;
select throws_ok($$select public.put_asset(repeat('c', 64), '초과')$$,
  'P0001', 'ASSET_LIMIT_REACHED', 'the 100-asset limit cannot be bypassed');
select set_config('request.jwt.claims',
  '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated","app_metadata":{"provider":"email"}}', true);
select throws_ok($$select public.delete_asset(repeat('a', 64), 1)$$,
  '42501', 'GOOGLE_ACCOUNT_REQUIRED', 'non-Google sessions cannot mutate assets');
select * from finish();
rollback;
