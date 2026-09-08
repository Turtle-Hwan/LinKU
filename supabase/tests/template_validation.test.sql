begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temporary table valid_document on commit drop as select
  '{"version":1,"name":"새 템플릿","height":1,"cloned":false,
    "createdAt":"2026-09-08T00:00:00Z","updatedAt":"2026-09-08T00:00:00Z",
    "items":[{"templateItemId":1,"name":"링쿠","siteUrl":"https://example.test/",
      "position":{"x":0,"y":0},"size":{"width":1,"height":1},
      "icon":{"kind":"builtin","key":"link"}}],"stagingItems":[]}'::jsonb as document;

create temporary table malformed_documents (label text, document jsonb) on commit drop;
insert into malformed_documents values
  ('missing document', null), ('JSON null', 'null'), ('empty object', '{}'),
  ('array document', '[]'), ('scalar document', 'true');

insert into malformed_documents
select 'missing ' || field, document - field
from valid_document, lateral jsonb_object_keys(document) field
union all
select 'null ' || field, jsonb_set(document, array[field], 'null')
from valid_document, lateral jsonb_object_keys(document) field;

insert into malformed_documents
select 'missing ' || path::text, document #- path
from valid_document, unnest(array[
  '{items,0,templateItemId}', '{items,0,name}', '{items,0,siteUrl}',
  '{items,0,position}', '{items,0,position,x}', '{items,0,position,y}',
  '{items,0,size}', '{items,0,size,width}', '{items,0,size,height}',
  '{items,0,icon}', '{items,0,icon,kind}', '{items,0,icon,key}'
]) field, lateral (select field::text[] as path) paths
union all
select 'null ' || path::text, jsonb_set(document, path, 'null')
from valid_document, unnest(array[
  '{items,0,templateItemId}', '{items,0,name}', '{items,0,siteUrl}',
  '{items,0,position}', '{items,0,position,x}', '{items,0,position,y}',
  '{items,0,size}', '{items,0,size,width}', '{items,0,size,height}',
  '{items,0,icon}', '{items,0,icon,kind}', '{items,0,icon,key}'
]) field, lateral (select field::text[] as path) paths;

insert into malformed_documents
select 'invalid ' || field, jsonb_set(document, array[field], value)
from valid_document, (values
  ('version', '"1"'::jsonb), ('height', '1.5'::jsonb),
  ('items', '{}'::jsonb), ('stagingItems', '{}'::jsonb), ('cloned', '"false"'::jsonb)
) invalid(field, value);
insert into malformed_documents
select 'incomplete staging item', jsonb_set(document, '{stagingItems}', '[{"icon":{"kind":"builtin"}}]')
from valid_document
union all
select 'incomplete asset icon', jsonb_set(document, '{items,0,icon}',
  jsonb_build_object('kind', 'asset', 'hash', repeat('a', 64))) from valid_document;

select is(linku_private.is_valid_template_document(document), false, label || ' is rejected')
from malformed_documents;
select is(linku_private.is_valid_template_document(document), true, 'complete document remains valid')
from valid_document;
select is(linku_private.is_valid_template_document(jsonb_set(document, '{items}', '[]')), true,
  'initial empty canvas remains valid') from valid_document;

grant select on valid_document, malformed_documents to authenticated;
insert into auth.users (id, raw_app_meta_data) values
  ('77777777-7777-4777-8777-777777777777', '{"provider":"google"}');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated","app_metadata":{"provider":"google"}}', true);
select public.initialize_profile('따뜻한 건구스');

select throws_ok(format(
  'select public.put_template(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'', %L::jsonb, repeat(''a'', 64))', document),
  '22023', 'INVALID_TEMPLATE', label || ' cannot bypass the client through RPC')
from malformed_documents;
select is((select count(*)::integer from public.templates), 0, 'rejected documents are not stored');
select throws_ok($$select public.publish_template('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('a', 64))$$,
  'P0002', 'TEMPLATE_NOT_FOUND', 'rejected documents cannot be published');
select throws_ok(format('select public.put_template(null, %L::jsonb, repeat(''a'', 64))', document),
  '22023', 'INVALID_TEMPLATE', 'missing ID returns the validation error') from valid_document;
select throws_ok(format('select public.put_template(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'', %L::jsonb, null)', document),
  '22023', 'INVALID_TEMPLATE', 'missing hash returns the validation error') from valid_document;

select lives_ok(format('select public.put_template(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'', %L::jsonb, repeat(''a'', 64))',
  jsonb_set(document, '{items}', '[]')), 'empty canvas can be saved and synced') from valid_document;
select throws_ok($$select public.publish_template('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('a', 64))$$,
  '22023', 'EMPTY_TEMPLATE', 'empty canvas cannot be published through the RPC');
select is((select count(*)::integer from public.template_publications), 0, 'rejected publication leaves no public row');
select lives_ok(format('select public.put_template(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'', %L::jsonb, repeat(''b'', 64), 1)',
  jsonb_set(jsonb_set(document, '{stagingItems}', document -> 'items'), '{items}', '[]')),
  'staging-only canvas can still be synced') from valid_document;
select throws_ok($$select public.publish_template('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('b', 64))$$,
  '22023', 'EMPTY_TEMPLATE', 'staging items are not public links');
select lives_ok(format('select public.put_template(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'', %L::jsonb, repeat(''c'', 64), 2)', document),
  'adding a public link remains possible') from valid_document;
select lives_ok($$select public.publish_template('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('c', 64))$$,
  'a template with a link can be published');
select lives_ok(format('select public.put_template(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'', %L::jsonb, repeat(''d'', 64), 3)',
  jsonb_set(document, '{items}', '[]')), 'published template can retain a private empty draft') from valid_document;
select throws_ok($$select public.publish_template('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('d', 64), 1)$$,
  '22023', 'EMPTY_TEMPLATE', 'empty draft cannot replace a published snapshot');
select is((select revision from public.template_publications), 1::bigint, 'rejected update preserves the existing publication');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select jsonb_array_length(snapshot -> 'items') from public.browse_publications()), 1,
  'anonymous gallery still receives the previously published link');
select * from finish();
rollback;
