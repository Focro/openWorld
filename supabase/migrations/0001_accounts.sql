-- OpenWorld RPG: аккаунты, сохранения, ключи ИИ, модерация.
-- Применяется в Supabase-проект openWorld. Копия для репо: supabase/migrations/.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ===== profiles =====
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  locale       text not null default 'ru' check (locale in ('ru', 'en')),
  birth_date   date check (birth_date > date '1900-01-01'),
  adult_mode   boolean not null default false,
  banned_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Клиент может менять только эти колонки (banned_at, id, даты служебные недоступны).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, locale, birth_date, adult_mode) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function private.profiles_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Дата рождения ставится один раз; менять её может только сервер (service role).
  if old.birth_date is not null and new.birth_date is distinct from old.birth_date
     and current_user in ('authenticated', 'anon') then
    raise exception 'birth_date_locked';
  end if;
  -- Взрослый режим только 18+.
  if new.adult_mode and (new.birth_date is null
       or new.birth_date > (current_date - interval '18 years')::date) then
    raise exception 'adult_mode_requires_18';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function private.profiles_guard();

-- Профиль создаётся сам при регистрации.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name',
                                new.raw_user_meta_data ->> 'name'), 60))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.is_banned()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select banned_at is not null from public.profiles where id = (select auth.uid())), false);
$$;
grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_banned() to authenticated;

-- ===== saves =====
create table public.saves (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  world_id       text not null check (char_length(world_id) between 1 and 64),
  slot           text not null check (char_length(slot) between 1 and 64),
  schema_version int  not null default 1,
  data           jsonb not null check (pg_column_size(data) <= 1048576),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, world_id, slot)
);
alter table public.saves enable row level security;
revoke all on public.saves from anon;
grant select, insert, update, delete on public.saves to authenticated;

create policy saves_select_own on public.saves
  for select to authenticated using ((select auth.uid()) = user_id);
create policy saves_insert_own on public.saves
  for insert to authenticated
  with check ((select auth.uid()) = user_id and not private.is_banned());
create policy saves_update_own on public.saves
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and not private.is_banned());
create policy saves_delete_own on public.saves
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger saves_touch before update on public.saves
  for each row execute function private.touch_updated_at();

-- ===== api_keys: только шифротекст (PBKDF2-SHA256 + AES-GCM на клиенте) =====
create table public.api_keys (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider   text not null check (provider in ('deepseek', 'anthropic', 'openai', 'openrouter')),
  version    int  not null default 1,
  salt       text not null check (salt ~ '^[A-Za-z0-9+/=]{16,128}$'),
  iv         text not null check (iv ~ '^[A-Za-z0-9+/=]{12,64}$'),
  ciphertext text not null constraint api_keys_ciphertext_check check (
               char_length(ciphertext) between 24 and 8192
               and ciphertext ~ '^[A-Za-z0-9+/=]+$'
               and ciphertext !~* '^(sk-|sk_|key-)'),
  iterations int  not null check (iterations >= 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.api_keys enable row level security;
revoke all on public.api_keys from anon;
grant select, insert, update, delete on public.api_keys to authenticated;

create policy api_keys_select_own on public.api_keys
  for select to authenticated using ((select auth.uid()) = user_id);
create policy api_keys_insert_own on public.api_keys
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy api_keys_update_own on public.api_keys
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy api_keys_delete_own on public.api_keys
  for delete to authenticated using ((select auth.uid()) = user_id);
create trigger api_keys_touch before update on public.api_keys
  for each row execute function private.touch_updated_at();

-- ===== moderation_strikes: 3 предупреждения, 4-я попытка = бан =====
create table public.moderation_strikes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  category   text not null default 'child_safety',
  reason     text check (char_length(reason) <= 200),
  created_at timestamptz not null default now()
);
create index moderation_strikes_user_idx on public.moderation_strikes (user_id);
alter table public.moderation_strikes enable row level security;
revoke all on public.moderation_strikes from anon, authenticated;
grant select on public.moderation_strikes to authenticated;
create policy strikes_select_own on public.moderation_strikes
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function private.apply_ban()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.moderation_strikes
      where user_id = new.user_id and category = 'child_safety') >= 4 then
    update public.profiles set banned_at = coalesce(banned_at, now()) where id = new.user_id;
  end if;
  return new;
end $$;
create trigger strikes_apply_ban after insert on public.moderation_strikes
  for each row execute function private.apply_ban();

-- Клиент может только добавить предупреждение себе. Возвращает число предупреждений и бан.
create or replace function public.report_child_safety_strike(reason text default null)
returns table (strikes int, banned boolean)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  insert into public.moderation_strikes (user_id, category, reason)
  values (uid, 'child_safety', left(reason, 200));
  return query
    select (select count(*)::int from public.moderation_strikes s
            where s.user_id = uid and s.category = 'child_safety'),
           private.is_banned();
end $$;
revoke execute on function public.report_child_safety_strike(text) from public, anon;
grant execute on function public.report_child_safety_strike(text) to authenticated;

-- ===== исправление: TRUNCATE обходит RLS, клиентам он не нужен =====
revoke truncate, references, trigger on public.profiles, public.saves, public.api_keys, public.moderation_strikes from anon, authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
