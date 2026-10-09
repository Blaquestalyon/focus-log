-- Focus Log — read view used by Today, History, Reports and export (blueprint §4, §6, §7).
-- One row per session with its task and project flattened, so searches can match the task
-- name OR the project name in a single query. security_invoker = true: the caller's RLS on
-- sessions/tasks/projects applies, so the owner only ever sees their own rows.
-- Re-runnable (create or replace).

create or replace view public.session_rows with (security_invoker = true) as
select
  s.id,
  s.user_id,
  s.task_id,
  s.started_at,
  s.ended_at,
  s.duration_seconds,
  s.source,
  s.run_id,
  s.end_reason,
  s.edited_at,
  s.nudge_acknowledged_at,
  s.is_example,
  t.name        as task_name,
  t.archived_at as task_archived_at,
  t.project_id,
  p.name        as project_name,
  p.color       as project_color,
  p.archived_at as project_archived_at
from public.sessions s
join public.tasks t on t.id = s.task_id
left join public.projects p on p.id = t.project_id;

revoke all on public.session_rows from anon, public;
grant select on public.session_rows to authenticated, service_role;

-- Exactly-once email claim (§8 "Exactly-once sending"). PostgREST cannot name the partial
-- unique index's predicate in ON CONFLICT, so the insert lives here. Service role only.
create or replace function public.fl_email_log_claim(
  p_user_id uuid, p_kind text, p_ref_key text, p_status text, p_to text, p_subject text)
returns uuid
language sql
security invoker
set search_path = public
as $$
  insert into public.email_log (user_id, kind, ref_key, status, to_email, subject, attempts, next_attempt_at)
  values (p_user_id, p_kind, p_ref_key, p_status, p_to, p_subject, 0,
          case when p_status = 'sending' then now() + interval '10 minutes' end)
  on conflict (user_id, kind, ref_key) where is_example = false do nothing
  returning id
$$;
revoke execute on function public.fl_email_log_claim(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.fl_email_log_claim(uuid, text, text, text, text, text) to service_role;
