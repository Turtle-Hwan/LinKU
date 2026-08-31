create extension if not exists pg_trgm with schema extensions;

create schema if not exists linku_private;
revoke all on schema linku_private from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default '링쿠 사용자',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nickname_length check (
    char_length(btrim(nickname)) between 1 and 32
  )
);

create table public.templates (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document jsonb not null,
  content_hash text not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint templates_content_hash_format check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint templates_revision_positive check (revision > 0),
  constraint templates_document_size check (pg_column_size(document) <= 262144)
);

create index templates_owner_updated_idx
  on public.templates (owner_id, updated_at desc);

create table public.template_assets (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content_hash text not null,
  name text not null,
  object_path text not null,
  byte_size integer not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, content_hash),
  constraint template_assets_hash_format check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint template_assets_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint template_assets_path_matches_owner check (
    object_path = owner_id::text || '/' || content_hash || '.webp'
  ),
  constraint template_assets_size check (byte_size between 1 and 524288)
);

create table public.template_publications (
  template_id uuid primary key references public.templates (id) on delete restrict,
  owner_id uuid not null references auth.users (id) on delete cascade,
  snapshot jsonb not null,
  source_content_hash text not null,
  revision bigint not null default 1,
  author_nickname text not null,
  like_count bigint not null default 0,
  clone_count bigint not null default 0,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unpublished_at timestamptz,
  constraint publications_hash_format check (source_content_hash ~ '^[0-9a-f]{64}$'),
  constraint publications_revision_positive check (revision > 0),
  constraint publications_author_length check (
    char_length(btrim(author_nickname)) between 1 and 32
  ),
  constraint publications_counts_nonnegative check (like_count >= 0 and clone_count >= 0),
  constraint publications_snapshot_size check (pg_column_size(snapshot) <= 262144)
);

create index publications_active_latest_idx
  on public.template_publications (published_at desc)
  where unpublished_at is null;
create index publications_active_likes_idx
  on public.template_publications (like_count desc, published_at desc)
  where unpublished_at is null;
create index publications_active_clones_idx
  on public.template_publications (clone_count desc, published_at desc)
  where unpublished_at is null;
create index publications_template_name_trgm_idx
  on public.template_publications
  using gin ((snapshot ->> 'name') extensions.gin_trgm_ops)
  where unpublished_at is null;

create table public.publication_likes (
  publication_id uuid not null references public.template_publications (template_id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (publication_id, user_id)
);

create index publication_likes_user_idx
  on public.publication_likes (user_id, created_at desc);

create or replace function linku_private.is_http_url(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value ~ '^https?://[^[:space:]]+$' and char_length(value) <= 2048;
$$;

create or replace function linku_private.is_valid_icon(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case value ->> 'kind'
    when 'builtin' then
      jsonb_typeof(value -> 'key') = 'string'
      and char_length(value ->> 'key') between 1 and 80
    when 'asset' then
      jsonb_typeof(value -> 'hash') = 'string'
      and (value ->> 'hash') ~ '^[0-9a-f]{64}$'
      and jsonb_typeof(value -> 'name') = 'string'
      and char_length(btrim(value ->> 'name')) between 1 and 80
    else false
  end;
$$;

create or replace function linku_private.is_valid_template_item(
  value jsonb,
  template_height integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    jsonb_typeof(value) = 'object'
    and jsonb_typeof(value -> 'templateItemId') = 'number'
    and (value ->> 'templateItemId')::numeric = trunc((value ->> 'templateItemId')::numeric)
    and (value ->> 'templateItemId')::numeric between -2147483648 and 2147483647
    and (value ->> 'templateItemId')::numeric <> 0
    and jsonb_typeof(value -> 'name') = 'string'
    and char_length(btrim(value ->> 'name')) between 1 and 80
    and jsonb_typeof(value -> 'siteUrl') = 'string'
    and linku_private.is_http_url(value ->> 'siteUrl')
    and jsonb_typeof(value -> 'position') = 'object'
    and jsonb_typeof(value #> '{position,x}') = 'number'
    and jsonb_typeof(value #> '{position,y}') = 'number'
    and jsonb_typeof(value -> 'size') = 'object'
    and jsonb_typeof(value #> '{size,width}') = 'number'
    and jsonb_typeof(value #> '{size,height}') = 'number'
    and (value #>> '{position,x}')::integer >= 0
    and (value #>> '{position,y}')::integer >= 0
    and (value #>> '{position,x}')::numeric = trunc((value #>> '{position,x}')::numeric)
    and (value #>> '{position,y}')::numeric = trunc((value #>> '{position,y}')::numeric)
    and (value #>> '{size,width}')::numeric = trunc((value #>> '{size,width}')::numeric)
    and (value #>> '{size,height}')::numeric = trunc((value #>> '{size,height}')::numeric)
    and (value #>> '{size,width}')::integer between 1 and 6
    and (value #>> '{size,height}')::integer between 1 and 6
    and (value #>> '{position,x}')::integer + (value #>> '{size,width}')::integer <= 6
    and (value #>> '{position,y}')::integer + (value #>> '{size,height}')::integer <= template_height
    and linku_private.is_valid_icon(value -> 'icon');
$$;

create or replace function linku_private.is_valid_template_document(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  template_height integer;
begin
  if jsonb_typeof(value) <> 'object'
    or value ->> 'version' <> '1'
    or jsonb_typeof(value -> 'name') <> 'string'
    or char_length(btrim(value ->> 'name')) not between 1 and 80
    or jsonb_typeof(value -> 'height') <> 'number'
    or jsonb_typeof(value -> 'items') <> 'array'
    or jsonb_typeof(value -> 'stagingItems') <> 'array'
    or jsonb_typeof(value -> 'cloned') <> 'boolean'
    or jsonb_typeof(value -> 'createdAt') <> 'string'
    or jsonb_typeof(value -> 'updatedAt') <> 'string'
    or jsonb_array_length(value -> 'items') > 36
    or jsonb_array_length(value -> 'stagingItems') > 36
    or (value ->> 'height')::numeric <> trunc((value ->> 'height')::numeric)
  then
    return false;
  end if;

  template_height := (value ->> 'height')::integer;
  if template_height not between 1 and 6 then
    return false;
  end if;

  for item in
    select entry from jsonb_array_elements(value -> 'items') as entries(entry)
    union all
    select entry from jsonb_array_elements(value -> 'stagingItems') as entries(entry)
  loop
    if not linku_private.is_valid_template_item(item, template_height) then
      return false;
    end if;
  end loop;

  return true;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$$;

alter table public.templates
  add constraint templates_document_valid
  check (linku_private.is_valid_template_document(document));

create or replace function linku_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function linku_private.touch_updated_at();

create or replace function linku_private.create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger create_linku_profile
after insert on auth.users
for each row execute function linku_private.create_profile();

create or replace function linku_private.lock_account(target_user uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_user::text, 0)
  );
$$;

create or replace function linku_private.enforce_asset_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform linku_private.lock_account(new.owner_id);
  if not exists (
    select 1 from public.template_assets
    where owner_id = new.owner_id and content_hash = new.content_hash
  ) and (
    select count(*) from public.template_assets where owner_id = new.owner_id
  ) >= 100 then
    raise exception using errcode = 'P0001', message = 'ASSET_LIMIT_REACHED';
  end if;
  return new;
end;
$$;

create trigger template_assets_limit
before insert on public.template_assets
for each row execute function linku_private.enforce_asset_limit();

create or replace function linku_private.adjust_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.template_publications
    set like_count = like_count + 1
    where template_id = new.publication_id;
    return new;
  end if;

  update public.template_publications
  set like_count = greatest(like_count - 1, 0)
  where template_id = old.publication_id;
  return old;
end;
$$;

create trigger publication_likes_count
after insert or delete on public.publication_likes
for each row execute function linku_private.adjust_like_count();

create or replace function linku_private.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  app_metadata jsonb := coalesce(auth.jwt() -> 'app_metadata', '{}'::jsonb);
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'LOGIN_REQUIRED';
  end if;
  if coalesce(app_metadata ->> 'provider', '') <> 'google'
    and not coalesce(app_metadata -> 'providers' ? 'google', false)
  then
    raise exception using errcode = '42501', message = 'GOOGLE_ACCOUNT_REQUIRED';
  end if;
  return current_user_id;
end;
$$;

create or replace function linku_private.is_google_session()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null and (
    auth.jwt() -> 'app_metadata' ->> 'provider' = 'google'
    or coalesce(auth.jwt() -> 'app_metadata' -> 'providers' ? 'google', false)
  );
$$;

create or replace function public.put_template(
  p_id uuid,
  p_document jsonb,
  p_content_hash text,
  p_expected_revision bigint default null
)
returns public.templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := linku_private.require_user();
  current_record public.templates;
  saved public.templates;
  stale_template_id uuid;
begin
  if not linku_private.is_valid_template_document(p_document)
    or pg_column_size(p_document) > 262144
    or p_content_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception using errcode = '22023', message = 'INVALID_TEMPLATE';
  end if;

  perform linku_private.lock_account(current_user_id);

  select * into current_record
  from public.templates
  where id = p_id;

  if not found then
    if p_expected_revision is not null then
      raise exception using errcode = '40001', message = 'LINKU_CONFLICT';
    end if;
    if (select count(*) from public.templates where owner_id = current_user_id and deleted_at is null) >= 100 then
      raise exception using errcode = 'P0001', message = 'TEMPLATE_LIMIT_REACHED';
    end if;

    for stale_template_id in
      select id
      from public.templates
      where owner_id = current_user_id and deleted_at is not null
      order by deleted_at desc, id
      offset 100
    loop
      delete from public.template_publications
      where template_id = stale_template_id and unpublished_at is not null;
      delete from public.templates
      where id = stale_template_id
        and not exists (
          select 1 from public.template_publications
          where template_id = stale_template_id
        );
    end loop;

    insert into public.templates (id, owner_id, document, content_hash)
    values (p_id, current_user_id, p_document, p_content_hash)
    returning * into saved;
    return saved;
  end if;

  if current_record.owner_id <> current_user_id
    or p_expected_revision is null
    or current_record.revision <> p_expected_revision
  then
    raise exception using errcode = '40001', message = 'LINKU_CONFLICT';
  end if;

  update public.templates
  set document = p_document,
      content_hash = p_content_hash,
      revision = revision + 1,
      updated_at = now(),
      deleted_at = null
  where id = p_id
    and owner_id = current_user_id
    and revision = p_expected_revision
  returning * into saved;

  if saved.id is null then
    raise exception using errcode = '40001', message = 'LINKU_CONFLICT';
  end if;
  return saved;
end;
$$;

create or replace function public.delete_template(
  p_id uuid,
  p_expected_revision bigint
)
returns public.templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := linku_private.require_user();
  deleted public.templates;
begin
  perform linku_private.lock_account(current_user_id);

  if exists (
    select 1 from public.template_publications
    where template_id = p_id and owner_id = current_user_id and unpublished_at is null
  ) then
    raise exception using errcode = '55000', message = 'PUBLICATION_ACTIVE';
  end if;

  update public.templates
  set revision = revision + 1,
      updated_at = now(),
      deleted_at = now()
  where id = p_id
    and owner_id = current_user_id
    and revision = p_expected_revision
    and deleted_at is null
  returning * into deleted;

  if deleted.id is null then
    raise exception using errcode = '40001', message = 'LINKU_CONFLICT';
  end if;
  return deleted;
end;
$$;

create or replace function public.update_nickname(p_nickname text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := linku_private.require_user();
  normalized text := btrim(p_nickname);
  updated_profile public.profiles;
begin
  perform linku_private.lock_account(current_user_id);

  if char_length(normalized) not between 1 and 32 then
    raise exception using errcode = '22023', message = 'INVALID_NICKNAME';
  end if;

  insert into public.profiles (user_id, nickname)
  values (current_user_id, normalized)
  on conflict (user_id) do update set nickname = excluded.nickname
  returning * into updated_profile;

  update public.template_publications
  set author_nickname = normalized,
      updated_at = now()
  where owner_id = current_user_id and unpublished_at is null;

  return updated_profile;
end;
$$;

create or replace function public.publish_template(
  p_template_id uuid,
  p_expected_revision bigint default null
)
returns public.template_publications
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := linku_private.require_user();
  source public.templates;
  profile public.profiles;
  current_publication public.template_publications;
  public_snapshot jsonb;
  saved public.template_publications;
begin
  perform linku_private.lock_account(current_user_id);

  select * into source
  from public.templates
  where id = p_template_id and owner_id = current_user_id and deleted_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'TEMPLATE_NOT_FOUND';
  end if;

  select * into profile from public.profiles where user_id = current_user_id;
  if not found then
    insert into public.profiles (user_id) values (current_user_id)
    returning * into profile;
  end if;

  public_snapshot := jsonb_build_object(
    'version', source.document -> 'version',
    'name', source.document -> 'name',
    'height', source.document -> 'height',
    'items', source.document -> 'items'
  );

  select * into current_publication
  from public.template_publications
  where template_id = p_template_id;

  if not found then
    if p_expected_revision is not null then
      raise exception using errcode = '40001', message = 'LINKU_CONFLICT';
    end if;
    if (
      select count(*) from public.template_publications
      where owner_id = current_user_id and unpublished_at is null
    ) >= 25 then
      raise exception using errcode = 'P0001', message = 'PUBLICATION_LIMIT_REACHED';
    end if;

    insert into public.template_publications (
      template_id, owner_id, snapshot, source_content_hash, author_nickname
    ) values (
      p_template_id, current_user_id, public_snapshot, source.content_hash, profile.nickname
    ) returning * into saved;
    return saved;
  end if;

  if current_publication.owner_id <> current_user_id
    or p_expected_revision is null
    or current_publication.revision <> p_expected_revision
  then
    raise exception using errcode = '40001', message = 'LINKU_CONFLICT';
  end if;

  if current_publication.unpublished_at is not null and (
    select count(*) from public.template_publications
    where owner_id = current_user_id and unpublished_at is null
  ) >= 25 then
    raise exception using errcode = 'P0001', message = 'PUBLICATION_LIMIT_REACHED';
  end if;

  update public.template_publications
  set snapshot = public_snapshot,
      source_content_hash = source.content_hash,
      revision = revision + 1,
      author_nickname = profile.nickname,
      updated_at = now(),
      published_at = case when unpublished_at is null then published_at else now() end,
      unpublished_at = null
  where template_id = p_template_id
    and owner_id = current_user_id
    and revision = p_expected_revision
  returning * into saved;

  if saved.template_id is null then
    raise exception using errcode = '40001', message = 'LINKU_CONFLICT';
  end if;
  return saved;
end;
$$;

create or replace function public.unpublish_template(
  p_template_id uuid,
  p_expected_revision bigint
)
returns public.template_publications
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := linku_private.require_user();
  saved public.template_publications;
begin
  perform linku_private.lock_account(current_user_id);

  update public.template_publications
  set revision = revision + 1,
      updated_at = now(),
      unpublished_at = now()
  where template_id = p_template_id
    and owner_id = current_user_id
    and revision = p_expected_revision
    and unpublished_at is null
  returning * into saved;

  if saved.template_id is null then
    raise exception using errcode = '40001', message = 'LINKU_CONFLICT';
  end if;
  return saved;
end;
$$;

create or replace function public.browse_publications(
  p_query text default '',
  p_sort text default 'latest',
  p_offset integer default 0,
  p_limit integer default 12
)
returns table (
  template_id uuid,
  snapshot jsonb,
  revision bigint,
  author_nickname text,
  like_count bigint,
  clone_count bigint,
  published_at timestamptz,
  updated_at timestamptz,
  is_liked boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  search_text text := left(btrim(coalesce(p_query, '')), 80);
  safe_offset integer := least(greatest(coalesce(p_offset, 0), 0), 1000);
  safe_limit integer := least(greatest(coalesce(p_limit, 12), 1), 24);
begin
  if p_sort not in ('latest', 'likes', 'clones') then
    raise exception using errcode = '22023', message = 'INVALID_SORT';
  end if;

  return query
  select
    publication.template_id,
    publication.snapshot,
    publication.revision,
    publication.author_nickname,
    publication.like_count,
    publication.clone_count,
    publication.published_at,
    publication.updated_at,
    exists (
      select 1 from public.publication_likes liked
      where liked.publication_id = publication.template_id
        and liked.user_id = auth.uid()
    ) as is_liked
  from public.template_publications publication
  where publication.unpublished_at is null
    and (
      search_text = ''
      or publication.snapshot ->> 'name' ilike '%' || search_text || '%'
      or publication.author_nickname ilike '%' || search_text || '%'
    )
  order by
    case when p_sort = 'likes' then publication.like_count end desc,
    case when p_sort = 'clones' then publication.clone_count end desc,
    publication.published_at desc,
    publication.template_id
  offset safe_offset
  limit safe_limit;
end;
$$;

create or replace function public.set_publication_liked(
  p_template_id uuid,
  p_liked boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := linku_private.require_user();
  current_count bigint;
begin
  perform linku_private.lock_account(current_user_id);

  if not exists (
    select 1 from public.template_publications
    where template_id = p_template_id and unpublished_at is null
  ) then
    raise exception using errcode = 'P0002', message = 'PUBLICATION_NOT_FOUND';
  end if;

  if p_liked then
    insert into public.publication_likes (publication_id, user_id)
    values (p_template_id, current_user_id)
    on conflict do nothing;
  else
    delete from public.publication_likes
    where publication_id = p_template_id and user_id = current_user_id;
  end if;
  select like_count into current_count
  from public.template_publications where template_id = p_template_id;
  return current_count;
end;
$$;

create or replace function public.record_publication_clone(p_template_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count bigint;
begin
  perform linku_private.require_user();
  update public.template_publications
  set clone_count = clone_count + 1
  where template_id = p_template_id and unpublished_at is null
  returning clone_count into current_count;
  if current_count is null then
    raise exception using errcode = 'P0002', message = 'PUBLICATION_NOT_FOUND';
  end if;
  return current_count;
end;
$$;

create or replace function public.clear_linku_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := linku_private.require_user();
begin
  perform linku_private.lock_account(current_user_id);

  delete from public.publication_likes where user_id = current_user_id;
  delete from public.template_publications where owner_id = current_user_id;
  delete from public.template_assets where owner_id = current_user_id;
  delete from public.templates where owner_id = current_user_id;
  update public.profiles
  set nickname = '링쿠 사용자'
  where user_id = current_user_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.templates enable row level security;
alter table public.template_assets enable row level security;
alter table public.template_publications enable row level security;
alter table public.publication_likes enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated
using (user_id = auth.uid() and linku_private.is_google_session());

create policy templates_select_own on public.templates
for select to authenticated
using (owner_id = auth.uid() and linku_private.is_google_session());

create policy assets_select_own on public.template_assets
for select to authenticated
using (owner_id = auth.uid() and linku_private.is_google_session());

create policy assets_insert_own on public.template_assets
for insert to authenticated
with check (owner_id = auth.uid() and linku_private.is_google_session());

create policy assets_update_own on public.template_assets
for update to authenticated
using (owner_id = auth.uid() and linku_private.is_google_session())
with check (owner_id = auth.uid() and linku_private.is_google_session());

create policy publications_select_own on public.template_publications
for select to authenticated
using (owner_id = auth.uid() and linku_private.is_google_session());

create policy likes_select_own on public.publication_likes
for select to authenticated
using (user_id = auth.uid() and linku_private.is_google_session());

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.templates from anon, authenticated;
revoke all on table public.template_assets from anon, authenticated;
revoke all on table public.template_publications from anon, authenticated;
revoke all on table public.publication_likes from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.templates to authenticated;
grant select, insert, update on table public.template_assets to authenticated;
grant select on table public.template_publications to authenticated;
grant select on table public.publication_likes to authenticated;

revoke all on function public.put_template(uuid, jsonb, text, bigint) from public;
revoke all on function public.delete_template(uuid, bigint) from public;
revoke all on function public.update_nickname(text) from public;
revoke all on function public.publish_template(uuid, bigint) from public;
revoke all on function public.unpublish_template(uuid, bigint) from public;
revoke all on function public.browse_publications(text, text, integer, integer) from public;
revoke all on function public.set_publication_liked(uuid, boolean) from public;
revoke all on function public.record_publication_clone(uuid) from public;
revoke all on function public.clear_linku_data() from public;

grant execute on function public.put_template(uuid, jsonb, text, bigint) to authenticated;
grant execute on function public.delete_template(uuid, bigint) to authenticated;
grant execute on function public.update_nickname(text) to authenticated;
grant execute on function public.publish_template(uuid, bigint) to authenticated;
grant execute on function public.unpublish_template(uuid, bigint) to authenticated;
grant execute on function public.browse_publications(text, text, integer, integer) to anon, authenticated;
grant execute on function public.set_publication_liked(uuid, boolean) to authenticated;
grant execute on function public.record_publication_clone(uuid) to authenticated;
grant execute on function public.clear_linku_data() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('template-assets', 'template-assets', false, 524288, array['image/webp']),
  ('published-template-assets', 'published-template-assets', true, 524288, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function linku_private.can_store_private_asset(
  target_user uuid,
  target_name text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform linku_private.lock_account(target_user);
  return exists (
    select 1 from storage.objects
    where bucket_id = 'template-assets' and name = target_name
  ) or (
    select count(*) from storage.objects
    where bucket_id = 'template-assets'
      and (storage.foldername(name))[1] = target_user::text
  ) < 100;
end;
$$;

create or replace function linku_private.can_store_published_asset(
  target_user uuid,
  target_name text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform linku_private.lock_account(target_user);
  return exists (
    select 1 from storage.objects
    where bucket_id = 'published-template-assets' and name = target_name
  ) or (
    select count(*)
    from storage.objects object
    join public.templates source
      on source.id::text = (storage.foldername(object.name))[1]
    where object.bucket_id = 'published-template-assets'
      and source.owner_id = target_user
  ) < 900;
end;
$$;

create policy private_assets_select_own on storage.objects
for select to authenticated
using (
  bucket_id = 'template-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and coalesce(array_length(storage.foldername(name), 1), 0) = 1
  and storage.filename(name) ~ '^[0-9a-f]{64}[.]webp$'
  and linku_private.is_google_session()
);

create policy private_assets_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'template-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and coalesce(array_length(storage.foldername(name), 1), 0) = 1
  and storage.filename(name) ~ '^[0-9a-f]{64}[.]webp$'
  and linku_private.can_store_private_asset(auth.uid(), name)
  and linku_private.is_google_session()
);

create policy private_assets_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'template-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and coalesce(array_length(storage.foldername(name), 1), 0) = 1
  and storage.filename(name) ~ '^[0-9a-f]{64}[.]webp$'
  and linku_private.is_google_session()
)
with check (
  bucket_id = 'template-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and coalesce(array_length(storage.foldername(name), 1), 0) = 1
  and storage.filename(name) ~ '^[0-9a-f]{64}[.]webp$'
  and linku_private.is_google_session()
);

create policy private_assets_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'template-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and coalesce(array_length(storage.foldername(name), 1), 0) = 1
  and storage.filename(name) ~ '^[0-9a-f]{64}[.]webp$'
  and linku_private.is_google_session()
);

create policy published_assets_select_owner on storage.objects
for select to authenticated
using (
  bucket_id = 'published-template-assets'
  and coalesce(array_length(storage.foldername(name), 1), 0) = 1
  and storage.filename(name) ~ '^[0-9a-f]{64}[.]webp$'
  and linku_private.is_google_session()
  and exists (
    select 1 from public.templates
    where id::text = (storage.foldername(name))[1]
      and owner_id = auth.uid()
  )
);

create policy published_assets_insert_owner on storage.objects
for insert to authenticated
with check (
  bucket_id = 'published-template-assets'
  and coalesce(array_length(storage.foldername(name), 1), 0) = 1
  and storage.filename(name) ~ '^[0-9a-f]{64}[.]webp$'
  and linku_private.is_google_session()
  and linku_private.can_store_published_asset(auth.uid(), name)
  and exists (
    select 1
    from public.templates source,
      jsonb_array_elements(source.document -> 'items') item
    where source.id::text = (storage.foldername(name))[1]
      and source.owner_id = auth.uid()
      and source.deleted_at is null
      and item -> 'icon' ->> 'kind' = 'asset'
      and item -> 'icon' ->> 'hash' = substring(
        storage.filename(name) from '^([0-9a-f]{64})[.]webp$'
      )
  )
);

create policy published_assets_update_owner on storage.objects
for update to authenticated
using (
  bucket_id = 'published-template-assets'
  and coalesce(array_length(storage.foldername(name), 1), 0) = 1
  and storage.filename(name) ~ '^[0-9a-f]{64}[.]webp$'
  and linku_private.is_google_session()
  and exists (
    select 1 from public.templates
    where id::text = (storage.foldername(name))[1]
      and owner_id = auth.uid()
  )
)
with check (
  bucket_id = 'published-template-assets'
  and coalesce(array_length(storage.foldername(name), 1), 0) = 1
  and storage.filename(name) ~ '^[0-9a-f]{64}[.]webp$'
  and linku_private.is_google_session()
  and exists (
    select 1
    from public.templates source,
      jsonb_array_elements(source.document -> 'items') item
    where source.id::text = (storage.foldername(name))[1]
      and source.owner_id = auth.uid()
      and source.deleted_at is null
      and item -> 'icon' ->> 'kind' = 'asset'
      and item -> 'icon' ->> 'hash' = substring(
        storage.filename(name) from '^([0-9a-f]{64})[.]webp$'
      )
  )
);

create policy published_assets_delete_owner on storage.objects
for delete to authenticated
using (
  bucket_id = 'published-template-assets'
  and coalesce(array_length(storage.foldername(name), 1), 0) = 1
  and storage.filename(name) ~ '^[0-9a-f]{64}[.]webp$'
  and linku_private.is_google_session()
  and exists (
    select 1 from public.templates
    where id::text = (storage.foldername(name))[1]
      and owner_id = auth.uid()
  )
);
