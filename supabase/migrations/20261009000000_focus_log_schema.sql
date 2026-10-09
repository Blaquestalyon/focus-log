-- Focus Log — initial schema (blueprint §3, §6, §10).
--
-- Written to be safe to run more than once: it is applied through the platform's
-- migration tool first, and the deploy's pre-deploy command (`supabase db push`)
-- may run it again on a database that already has it. Every statement below is
-- therefore "create if missing" / "create or replace" / "drop then create".

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- 2. Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Names are stored trimmed (§3 projects.name / tasks.name).
create or replace function public.fl_trim_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.name := btrim(new.name);
  return new;
end;
$$;

-- ISO 8601 UTC text with milliseconds, used in every timer view.
create or replace function public.fl__iso(p_ts timestamptz)
returns text
language sql
immutable
set search_path = public
as $$
  select case when p_ts is null then null
              else to_char(p_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
$$;

-- ---------------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                     text not null check (char_length(btrim(name)) between 1 and 60),
  color                    text not null default 'azure'
                           check (color in ('azure','violet','rose','coral','lime','teal','sand','slate')),
  archived_at              timestamptz,
  is_example               boolean not null default false,
  claimed_from_example_at  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table if not exists public.tasks (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id               uuid references public.projects(id) on delete cascade,
  name                     text not null check (char_length(btrim(name)) between 1 and 80),
  archived_at              timestamptz,
  last_used_at             timestamptz,
  is_example               boolean not null default false,
  claimed_from_example_at  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id                      uuid primary key references auth.users(id) on delete cascade,
  time_zone                    text not null default 'America/New_York',
  time_zone_confirmed          boolean not null default false,
  nudge_after_minutes          integer not null default 240
                               constraint user_settings_nudge_range check (nudge_after_minutes between 30 and 720),
  nudge_email_enabled          boolean not null default true,
  nudge_browser_enabled        boolean not null default true,
  weekly_email_enabled         boolean not null default true,
  last_project_id              uuid references public.projects(id) on delete set null,
  example_notice_dismissed_at  timestamptz,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

create table if not exists public.sessions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id                uuid not null references public.tasks(id) on delete restrict,
  started_at             timestamptz not null,
  ended_at               timestamptz,
  duration_seconds       integer generated always as (
                           case when ended_at is null then null
                                else floor(extract(epoch from ended_at - started_at))::int end
                         ) stored,
  source                 text not null default 'timer' check (source in ('timer','manual')),
  run_id                 uuid,
  end_reason             text check (end_reason in ('pause','stop','switch')),
  edited_at              timestamptz,
  nudge_acknowledged_at  timestamptz,
  is_example             boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint sessions_end_after_start check (ended_at is null or ended_at > started_at),
  constraint sessions_max_24h check (ended_at is null or ended_at - started_at <= interval '24 hours'),
  constraint sessions_no_overlap exclude using gist (
    user_id with =,
    tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz), '[)') with &&
  )
);

create table if not exists public.timer_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  status      text not null default 'idle' check (status in ('idle','running','paused')),
  task_id     uuid references public.tasks(id) on delete restrict,
  session_id  uuid references public.sessions(id) on delete restrict,
  run_id      uuid,
  paused_at   timestamptz,
  stopped_at  timestamptz,
  updated_at  timestamptz not null default now(),
  constraint timer_state_shape check (
       (status = 'idle'    and task_id is null     and session_id is null     and run_id is null     and paused_at is null)
    or (status = 'running' and task_id is not null and session_id is not null and run_id is not null and paused_at is null     and stopped_at is null)
    or (status = 'paused'  and task_id is not null and session_id is null     and run_id is not null and paused_at is not null and stopped_at is null)
  )
);

create table if not exists public.email_log (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  kind                 text not null check (kind in ('nudge','weekly_summary','test','password_link')),
  ref_key              text not null,
  status               text not null check (status in ('sending','sent','failed','skipped_empty','skipped_acknowledged')),
  to_email             text not null,
  subject              text not null,
  provider_message_id  text,
  error                text check (error is null or char_length(error) <= 300),
  attempts             integer not null default 0 check (attempts between 0 and 3),
  next_attempt_at      timestamptz,
  is_example           boolean not null default false,
  created_at           timestamptz not null default now(),
  sent_at              timestamptz
);

create table if not exists public.push_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint               text not null check (endpoint like 'https://%' and char_length(endpoint) <= 2048),
  p256dh                 text not null,
  auth_secret            text not null,
  label                  text not null check (char_length(label) between 1 and 60),
  last_seen_at           timestamptz not null default now(),
  last_success_at        timestamptz,
  last_failure_at        timestamptz,
  last_error             text check (last_error is null or char_length(last_error) <= 300),
  nudge_session_id       uuid references public.sessions(id) on delete set null,
  nudge_status           text check (nudge_status in ('sending','sent','failed')),
  nudge_attempts         integer not null default 0 check (nudge_attempts between 0 and 3),
  nudge_next_attempt_at  timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------
create unique index if not exists projects_user_name_uq on public.projects (user_id, lower(name));

create unique index if not exists tasks_user_project_name_uq on public.tasks
  (user_id, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index if not exists tasks_user_last_used_idx on public.tasks (user_id, last_used_at desc nulls last);
create index if not exists tasks_project_idx on public.tasks (project_id);

create unique index if not exists sessions_one_running on public.sessions (user_id) where ended_at is null;
create index if not exists sessions_user_started_idx on public.sessions (user_id, started_at desc);
create index if not exists sessions_user_duration_idx on public.sessions (user_id, duration_seconds desc, id desc);
create index if not exists sessions_task_idx on public.sessions (task_id);
create index if not exists sessions_run_idx on public.sessions (run_id);

create unique index if not exists email_log_once_uq on public.email_log (user_id, kind, ref_key) where is_example = false;
create index if not exists email_log_user_created_idx on public.email_log (user_id, created_at desc, id desc);

create unique index if not exists push_subscriptions_endpoint_uq on public.push_subscriptions (endpoint);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- 5. updated_at and trimming triggers
-- ---------------------------------------------------------------------------
drop trigger if exists set_updated_at on public.user_settings;
create trigger set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.projects;
create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.tasks;
create trigger set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.sessions;
create trigger set_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.timer_state;
create trigger set_updated_at before update on public.timer_state
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.push_subscriptions;
create trigger set_updated_at before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists fl_trim_name on public.projects;
create trigger fl_trim_name before insert or update of name on public.projects
  for each row execute function public.fl_trim_name();
drop trigger if exists fl_trim_name on public.tasks;
create trigger fl_trim_name before insert or update of name on public.tasks
  for each row execute function public.fl_trim_name();

-- ---------------------------------------------------------------------------
-- 6. Row-level security and grants. Every row belongs to its owner; the
--    anon role gets nothing anywhere (no public tables in this app).
-- ---------------------------------------------------------------------------
alter table public.user_settings      enable row level security;
alter table public.projects           enable row level security;
alter table public.tasks              enable row level security;
alter table public.sessions           enable row level security;
alter table public.timer_state        enable row level security;
alter table public.email_log          enable row level security;
alter table public.push_subscriptions enable row level security;

revoke all on public.user_settings, public.projects, public.tasks, public.sessions,
              public.timer_state, public.email_log, public.push_subscriptions from anon;
revoke all on public.user_settings, public.projects, public.tasks, public.sessions,
              public.timer_state, public.email_log, public.push_subscriptions from public;

grant select, insert, update, delete on public.projects, public.tasks, public.sessions,
      public.push_subscriptions to authenticated, service_role;
-- user_settings / timer_state rows are created by the new-user trigger and removed by cascade.
grant select, update on public.user_settings, public.timer_state to authenticated;
grant select, insert, update, delete on public.user_settings, public.timer_state to service_role;
-- email_log is written only by the server (service role); the owner may read it.
grant select on public.email_log to authenticated;
grant select, insert, update, delete on public.email_log to service_role;

-- user_settings
drop policy if exists user_settings_select_own on public.user_settings;
create policy user_settings_select_own on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists user_settings_update_own on public.user_settings;
create policy user_settings_update_own on public.user_settings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- projects
drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own on public.projects
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own on public.projects
  for delete to authenticated using (user_id = (select auth.uid()));

-- tasks
drop policy if exists tasks_select_own on public.tasks;
create policy tasks_select_own on public.tasks
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own on public.tasks
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (project_id is null or exists (
      select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))));
drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own on public.tasks
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and (project_id is null or exists (
      select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))));
drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own on public.tasks
  for delete to authenticated using (user_id = (select auth.uid()));

-- sessions
drop policy if exists sessions_select_own on public.sessions;
create policy sessions_select_own on public.sessions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists sessions_insert_own on public.sessions;
create policy sessions_insert_own on public.sessions
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid())));
drop policy if exists sessions_update_own on public.sessions;
create policy sessions_update_own on public.sessions
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid())));
drop policy if exists sessions_delete_own on public.sessions;
create policy sessions_delete_own on public.sessions
  for delete to authenticated using (user_id = (select auth.uid()));

-- timer_state
drop policy if exists timer_state_select_own on public.timer_state;
create policy timer_state_select_own on public.timer_state
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists timer_state_update_own on public.timer_state;
create policy timer_state_update_own on public.timer_state
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- email_log (read-only for the owner)
drop policy if exists email_log_select_own on public.email_log;
create policy email_log_select_own on public.email_log
  for select to authenticated using (user_id = (select auth.uid()));

-- push_subscriptions
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 7. Timer functions (§3 Database functions, §6 Timer states). All run as the
--    calling user (SECURITY INVOKER), lock timer_state first, and use the
--    database clock. Whenever the open session is deleted, timer_state is
--    moved off it first (sessions are referenced ON DELETE RESTRICT).
-- ---------------------------------------------------------------------------

-- Sum of the closed sessions of a run, and its earliest start.
create or replace function public.fl__run_closed_seconds(p_user_id uuid, p_run_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(sum(duration_seconds), 0)::int
    from public.sessions
   where user_id = p_user_id and run_id = p_run_id and ended_at is not null
$$;

create or replace function public.fl_timer_view()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_state    public.timer_state%rowtype;
  v_task     jsonb;
  v_project  jsonb;
  v_session  jsonb := null;
  v_run      jsonb := null;
  v_nudge    jsonb := null;
  v_open     public.sessions%rowtype;
  v_after    integer;
  v_due      timestamptz;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_state from public.timer_state where user_id = v_uid;
  if not found or v_state.status = 'idle' then
    return jsonb_build_object(
      'status', 'idle', 'server_now', public.fl__iso(now()),
      'task', null, 'project', null, 'session', null, 'run', null,
      'paused_at', null, 'nudge', null);
  end if;

  select jsonb_build_object('id', t.id, 'name', t.name, 'archived', t.archived_at is not null),
         case when p.id is null then null
              else jsonb_build_object('id', p.id, 'name', p.name, 'color', p.color, 'archived', p.archived_at is not null) end
    into v_task, v_project
    from public.tasks t
    left join public.projects p on p.id = t.project_id
   where t.id = v_state.task_id;

  select jsonb_build_object(
           'started_at', public.fl__iso(min(s.started_at)),
           'closed_seconds', coalesce(sum(s.duration_seconds) filter (where s.ended_at is not null), 0))
    into v_run
    from public.sessions s
   where s.user_id = v_uid and s.run_id = v_state.run_id;

  if v_state.status = 'running' then
    select * into v_open from public.sessions where id = v_state.session_id;
    v_session := jsonb_build_object('id', v_open.id, 'started_at', public.fl__iso(v_open.started_at));
    select nudge_after_minutes into v_after from public.user_settings where user_id = v_uid;
    v_after := coalesce(v_after, 240);
    v_due := v_open.started_at + make_interval(mins => v_after);
    v_nudge := jsonb_build_object(
      'after_minutes', v_after,
      'due_at', public.fl__iso(v_due),
      'acknowledged', v_open.nudge_acknowledged_at is not null,
      'active', now() >= v_due and v_open.nudge_acknowledged_at is null);
  end if;

  return jsonb_build_object(
    'status', v_state.status,
    'server_now', public.fl__iso(now()),
    'task', v_task,
    'project', v_project,
    'session', v_session,
    'run', v_run,
    'paused_at', public.fl__iso(v_state.paused_at),
    'nudge', v_nudge);
end;
$$;

create or replace function public.fl__lock_state()
returns public.timer_state
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_state public.timer_state%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  select * into v_state from public.timer_state where user_id = auth.uid() for update;
  if not found then
    raise exception 'FL_NOT_RUNNING' using errcode = 'P0001';
  end if;
  return v_state;
end;
$$;

create or replace function public.fl_timer_start(p_task_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_state     public.timer_state%rowtype;
  v_task      public.tasks%rowtype;
  v_open      public.sessions%rowtype;
  v_new_id    uuid;
  v_run       uuid;
  v_closed    jsonb := null;
  v_drop      boolean := false;
  v_secs      integer;
  v_old_run   uuid;
begin
  v_state := public.fl__lock_state();

  -- 1. the task must exist for this user and be active
  select * into v_task from public.tasks where id = p_task_id and user_id = v_uid;
  if not found then
    raise exception 'FL_TASK_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_task.archived_at is not null then
    raise exception 'FL_TASK_ARCHIVED' using errcode = 'P0001';
  end if;

  -- 2. running on the same task: nothing changes
  if v_state.status = 'running' and v_state.task_id = p_task_id then
    return public.fl_timer_view() || jsonb_build_object('already_running', true);
  end if;

  -- 3. paused on the same task: resume the run
  if v_state.status = 'paused' and v_state.task_id = p_task_id then
    insert into public.sessions (user_id, task_id, started_at, source, run_id)
    values (v_uid, p_task_id, now(), 'timer', v_state.run_id)
    returning id into v_new_id;
    update public.timer_state
       set status = 'running', session_id = v_new_id, paused_at = null, stopped_at = null
     where user_id = v_uid;
    update public.tasks set last_used_at = now() where id = p_task_id;
    update public.user_settings set last_project_id = v_task.project_id where user_id = v_uid;
    return public.fl_timer_view() || jsonb_build_object('resumed', true);
  end if;

  -- 4. running on another task: close the open session with 'switch'
  if v_state.status = 'running' then
    select * into v_open from public.sessions where id = v_state.session_id for update;
    if now() - v_open.started_at > interval '24 hours' then
      raise exception 'FL_STOP_TOO_LONG' using errcode = 'P0001';
    end if;
    v_old_run := v_state.run_id;
    v_drop := (now() - v_open.started_at) < interval '5 seconds';
    v_secs := floor(extract(epoch from now() - v_open.started_at))::int;
    update public.sessions set ended_at = now(), end_reason = 'switch' where id = v_open.id;
  end if;

  -- 5. paused on another task: the paused run simply ends (nothing written)

  -- 6. start a new run
  v_run := gen_random_uuid();
  insert into public.sessions (user_id, task_id, started_at, source, run_id)
  values (v_uid, p_task_id, now(), 'timer', v_run)
  returning id into v_new_id;
  update public.timer_state
     set status = 'running', task_id = p_task_id, session_id = v_new_id, run_id = v_run,
         paused_at = null, stopped_at = null
   where user_id = v_uid;
  if v_drop then
    delete from public.sessions where id = v_open.id;
  end if;

  -- 7. remember what was used
  update public.tasks set last_used_at = now() where id = p_task_id;
  update public.user_settings set last_project_id = v_task.project_id where user_id = v_uid;

  if v_old_run is not null then
    v_closed := jsonb_build_object(
      'id', v_open.id,
      'seconds', v_secs,
      'run_seconds', public.fl__run_closed_seconds(v_uid, v_old_run),
      'dropped', v_drop,
      'end_reason', 'switch',
      'from', 'running');
    return public.fl_timer_view() || jsonb_build_object('closed_session', v_closed);
  end if;
  return public.fl_timer_view();
end;
$$;

create or replace function public.fl_timer_pause()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_state  public.timer_state%rowtype;
  v_open   public.sessions%rowtype;
  v_drop   boolean;
  v_secs   integer;
begin
  v_state := public.fl__lock_state();
  if v_state.status <> 'running' then
    raise exception 'FL_NOT_RUNNING' using errcode = 'P0001';
  end if;
  select * into v_open from public.sessions where id = v_state.session_id for update;
  if now() - v_open.started_at > interval '24 hours' then
    raise exception 'FL_STOP_TOO_LONG' using errcode = 'P0001';
  end if;

  update public.timer_state
     set status = 'paused', session_id = null, paused_at = now(), stopped_at = null
   where user_id = v_uid;

  v_drop := (now() - v_open.started_at) < interval '5 seconds';
  v_secs := floor(extract(epoch from now() - v_open.started_at))::int;
  if v_drop then
    delete from public.sessions where id = v_open.id;
  else
    update public.sessions set ended_at = now(), end_reason = 'pause' where id = v_open.id;
  end if;

  return public.fl_timer_view() || jsonb_build_object('closed_session', jsonb_build_object(
    'id', v_open.id,
    'seconds', v_secs,
    'run_seconds', public.fl__run_closed_seconds(v_uid, v_state.run_id),
    'dropped', v_drop,
    'end_reason', 'pause',
    'from', 'running'));
end;
$$;

create or replace function public.fl_timer_resume()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_state   public.timer_state%rowtype;
  v_task    public.tasks%rowtype;
  v_new_id  uuid;
begin
  v_state := public.fl__lock_state();
  if v_state.status <> 'paused' then
    raise exception 'FL_NOT_PAUSED' using errcode = 'P0001';
  end if;
  select * into v_task from public.tasks where id = v_state.task_id;
  if v_task.archived_at is not null then
    raise exception 'FL_TASK_ARCHIVED' using errcode = 'P0001';
  end if;

  insert into public.sessions (user_id, task_id, started_at, source, run_id)
  values (v_uid, v_state.task_id, now(), 'timer', v_state.run_id)
  returning id into v_new_id;
  update public.timer_state
     set status = 'running', session_id = v_new_id, paused_at = null, stopped_at = null
   where user_id = v_uid;
  update public.tasks set last_used_at = now() where id = v_state.task_id;

  return public.fl_timer_view();
end;
$$;

create or replace function public.fl_timer_stop(p_stop_at timestamptz default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_state    public.timer_state%rowtype;
  v_open     public.sessions%rowtype;
  v_last     public.sessions%rowtype;
  v_stop_at  timestamptz;
  v_drop     boolean;
  v_secs     integer;
  v_closed   jsonb := null;
begin
  v_state := public.fl__lock_state();

  if v_state.status = 'running' then
    select * into v_open from public.sessions where id = v_state.session_id for update;
    v_stop_at := coalesce(p_stop_at, now());
    if v_stop_at > now() then
      raise exception 'FL_STOP_IN_FUTURE' using errcode = 'P0001';
    end if;
    if v_stop_at <= v_open.started_at then
      raise exception 'FL_STOP_BEFORE_START' using errcode = 'P0001';
    end if;
    if v_stop_at - v_open.started_at > interval '24 hours' then
      raise exception 'FL_STOP_TOO_LONG' using errcode = 'P0001';
    end if;

    update public.timer_state
       set status = 'idle', task_id = null, session_id = null, run_id = null,
           paused_at = null, stopped_at = now()
     where user_id = v_uid;

    v_drop := (v_stop_at - v_open.started_at) < interval '5 seconds';
    v_secs := floor(extract(epoch from v_stop_at - v_open.started_at))::int;
    if v_drop then
      delete from public.sessions where id = v_open.id;
    else
      update public.sessions set ended_at = v_stop_at, end_reason = 'stop' where id = v_open.id;
    end if;

    v_closed := jsonb_build_object(
      'id', v_open.id,
      'seconds', v_secs,
      'run_seconds', public.fl__run_closed_seconds(v_uid, v_state.run_id),
      'dropped', v_drop,
      'end_reason', 'stop',
      'from', 'running');

  elsif v_state.status = 'paused' then
    if p_stop_at is not null then
      raise exception 'FL_NOT_RUNNING' using errcode = 'P0001';
    end if;

    select * into v_last from public.sessions
     where user_id = v_uid and run_id = v_state.run_id and ended_at is not null
     order by started_at desc, id desc
     limit 1;
    if found then
      v_closed := jsonb_build_object(
        'id', v_last.id,
        'seconds', v_last.duration_seconds,
        'run_seconds', public.fl__run_closed_seconds(v_uid, v_state.run_id),
        'dropped', false,
        'end_reason', v_last.end_reason,
        'from', 'paused');
    end if;

    update public.timer_state
       set status = 'idle', task_id = null, session_id = null, run_id = null,
           paused_at = null, stopped_at = now()
     where user_id = v_uid;

  else
    raise exception 'FL_NOT_RUNNING' using errcode = 'P0001';
  end if;

  if v_closed is null then
    return public.fl_timer_view();
  end if;
  return public.fl_timer_view() || jsonb_build_object('closed_session', v_closed);
end;
$$;

create or replace function public.fl_timer_discard()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_state  public.timer_state%rowtype;
begin
  v_state := public.fl__lock_state();
  if v_state.status = 'idle' then
    raise exception 'FL_NOT_RUNNING' using errcode = 'P0001';
  end if;

  update public.timer_state
     set status = 'idle', task_id = null, session_id = null, run_id = null,
         paused_at = null, stopped_at = null
   where user_id = v_uid;

  if v_state.status = 'running' then
    delete from public.sessions where id = v_state.session_id;
  end if;

  return public.fl_timer_view();
end;
$$;

create or replace function public.fl_timer_undo_stop(p_session_id uuid, p_restore text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_state  public.timer_state%rowtype;
  v_s      public.sessions%rowtype;
begin
  v_state := public.fl__lock_state();
  if v_state.status <> 'idle' or v_state.stopped_at is null
     or v_state.stopped_at < now() - interval '30 seconds' then
    raise exception 'FL_UNDO_EXPIRED' using errcode = 'P0001';
  end if;

  select * into v_s from public.sessions where id = p_session_id and user_id = v_uid for update;
  if not found or v_s.source <> 'timer' or v_s.run_id is null or v_s.ended_at is null then
    raise exception 'FL_UNDO_EXPIRED' using errcode = 'P0001';
  end if;
  -- it must still be the most recent session
  if exists (select 1 from public.sessions
              where user_id = v_uid and id <> v_s.id and started_at >= v_s.started_at) then
    raise exception 'FL_UNDO_EXPIRED' using errcode = 'P0001';
  end if;

  if p_restore = 'running' and v_s.end_reason = 'stop' then
    update public.sessions set ended_at = null, end_reason = null where id = v_s.id;
    update public.timer_state
       set status = 'running', task_id = v_s.task_id, session_id = v_s.id, run_id = v_s.run_id,
           paused_at = null, stopped_at = null
     where user_id = v_uid;
  elsif p_restore = 'paused' and v_s.end_reason = 'pause' then
    update public.timer_state
       set status = 'paused', task_id = v_s.task_id, session_id = null, run_id = v_s.run_id,
           paused_at = v_s.ended_at, stopped_at = null
     where user_id = v_uid;
  else
    raise exception 'FL_UNDO_EXPIRED' using errcode = 'P0001';
  end if;

  return public.fl_timer_view();
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Trigger functions: new user rows, moved sessions, example-data claims
-- ---------------------------------------------------------------------------
create or replace function public.fl_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.timer_state (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function public.fl_detach_moved_session()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.task_id is distinct from old.task_id then
    new.run_id := null;
  end if;
  return new;
end;
$$;

create or replace function public.fl_claim_example_on_session()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  update public.tasks
     set is_example = false, claimed_from_example_at = now()
   where id = new.task_id and is_example;

  select project_id into v_project_id from public.tasks where id = new.task_id;
  if v_project_id is not null then
    update public.projects
       set is_example = false, claimed_from_example_at = now()
     where id = v_project_id and is_example;
  end if;
  return null;
end;
$$;

create or replace function public.fl_claim_example_on_task()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.projects
     set is_example = false, claimed_from_example_at = now()
   where id = new.project_id and is_example;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Service-role-only data removal (§6 Example data, Delete all tracked data)
-- ---------------------------------------------------------------------------
create or replace function public.fl_admin_delete_user_data(p_user_id uuid, p_examples_only boolean)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_state     public.timer_state%rowtype;
  v_sessions  integer := 0;
  v_tasks     integer := 0;
  v_projects  integer := 0;
  v_emails    integer := 0;
  v_kept      jsonb;
begin
  select * into v_state from public.timer_state where user_id = p_user_id for update;

  if p_examples_only then
    -- 1. a sample task still on the clock becomes the owner's first
    if v_state.task_id is not null then
      update public.tasks set is_example = false, claimed_from_example_at = now()
       where id = v_state.task_id and is_example;
      update public.projects set is_example = false, claimed_from_example_at = now()
       where id = (select project_id from public.tasks where id = v_state.task_id) and is_example;
    end if;

    begin
      delete from public.sessions where user_id = p_user_id and is_example;
      get diagnostics v_sessions = row_count;
      delete from public.tasks where user_id = p_user_id and is_example;
      get diagnostics v_tasks = row_count;
      delete from public.projects where user_id = p_user_id and is_example;
      get diagnostics v_projects = row_count;
      delete from public.email_log where user_id = p_user_id and is_example;
      get diagnostics v_emails = row_count;
    exception when foreign_key_violation or restrict_violation then
      raise exception 'EXAMPLES_IN_USE' using errcode = 'P0001';
    end;

    update public.user_settings set last_project_id = null
     where user_id = p_user_id
       and last_project_id is not null
       and not exists (select 1 from public.projects p where p.id = last_project_id);

    select jsonb_build_object(
      'projects', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name)
                              from public.projects
                             where user_id = p_user_id and claimed_from_example_at is not null), '[]'::jsonb),
      'tasks',    coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name)
                              from public.tasks
                             where user_id = p_user_id and claimed_from_example_at is not null), '[]'::jsonb))
      into v_kept;

    return jsonb_build_object(
      'removed', jsonb_build_object('projects', v_projects, 'tasks', v_tasks,
                                    'sessions', v_sessions, 'emails', v_emails),
      'kept', v_kept);
  end if;

  -- Delete all tracked data: idle first (state off the open session), then everything.
  update public.timer_state
     set status = 'idle', task_id = null, session_id = null, run_id = null,
         paused_at = null, stopped_at = null
   where user_id = p_user_id;
  update public.user_settings set last_project_id = null where user_id = p_user_id;

  delete from public.sessions where user_id = p_user_id;
  get diagnostics v_sessions = row_count;
  delete from public.tasks where user_id = p_user_id;
  get diagnostics v_tasks = row_count;
  delete from public.projects where user_id = p_user_id;
  get diagnostics v_projects = row_count;
  delete from public.email_log where user_id = p_user_id;
  get diagnostics v_emails = row_count;

  return jsonb_build_object(
    'deleted', jsonb_build_object('projects', v_projects, 'tasks', v_tasks,
                                  'sessions', v_sessions, 'emails', v_emails));
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Triggers
-- ---------------------------------------------------------------------------
drop trigger if exists fl_handle_new_user on auth.users;
create trigger fl_handle_new_user after insert on auth.users
  for each row execute function public.fl_handle_new_user();

drop trigger if exists fl_detach_moved_session on public.sessions;
create trigger fl_detach_moved_session before update on public.sessions
  for each row execute function public.fl_detach_moved_session();

drop trigger if exists fl_claim_example_on_session on public.sessions;
create trigger fl_claim_example_on_session after insert or update of task_id on public.sessions
  for each row when (new.is_example = false) execute function public.fl_claim_example_on_session();

drop trigger if exists fl_claim_example_on_task on public.tasks;
create trigger fl_claim_example_on_task after insert or update of project_id on public.tasks
  for each row when (new.is_example = false and new.project_id is not null)
  execute function public.fl_claim_example_on_task();

-- ---------------------------------------------------------------------------
-- 11. Function privileges
-- ---------------------------------------------------------------------------
revoke execute on function
  public.fl_timer_view(), public.fl_timer_start(uuid), public.fl_timer_pause(),
  public.fl_timer_resume(), public.fl_timer_stop(timestamptz), public.fl_timer_discard(),
  public.fl_timer_undo_stop(uuid, text), public.fl__lock_state(),
  public.fl__run_closed_seconds(uuid, uuid), public.fl__iso(timestamptz)
  from public, anon;
grant execute on function
  public.fl_timer_view(), public.fl_timer_start(uuid), public.fl_timer_pause(),
  public.fl_timer_resume(), public.fl_timer_stop(timestamptz), public.fl_timer_discard(),
  public.fl_timer_undo_stop(uuid, text), public.fl__lock_state(),
  public.fl__run_closed_seconds(uuid, uuid), public.fl__iso(timestamptz)
  to authenticated, service_role;

revoke execute on function public.fl_admin_delete_user_data(uuid, boolean) from public, anon, authenticated;
grant execute on function public.fl_admin_delete_user_data(uuid, boolean) to service_role;

revoke execute on function
  public.fl_handle_new_user(), public.fl_detach_moved_session(),
  public.fl_claim_example_on_session(), public.fl_claim_example_on_task(),
  public.set_updated_at(), public.fl_trim_name()
  from public, anon, authenticated;
