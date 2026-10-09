-- ONE-OFF, ALREADY APPLIED 2026-10-09. NOT A MIGRATION — never move this into supabase/migrations.
-- Why: an earlier build session created the tables from a draft schema that was never committed;
-- the committed migration (create … if not exists) then landed on top of those tables, leaving a
-- hybrid (draft tables + current functions, a duplicate new-user trigger, a stray function).
-- The database held only example rows and the owner's unused account, so it was rebuilt to exactly
-- the committed migration. The owner's auth account is kept; example rows are re-seeded by seed.sql.

drop trigger if exists fl_on_auth_user_created on auth.users;
drop trigger if exists fl_handle_new_user on auth.users;
drop table if exists public.push_subscriptions, public.email_log, public.timer_state,
                     public.sessions, public.tasks, public.user_settings, public.projects cascade;
drop function if exists public.fl_run_closed_seconds(uuid);
drop function if exists public.fl__run_closed_seconds(uuid, uuid);
drop function if exists public.fl__lock_state();
drop function if exists public.fl__iso(timestamptz);
drop function if exists public.fl_timer_view();
drop function if exists public.fl_timer_start(uuid);
drop function if exists public.fl_timer_pause();
drop function if exists public.fl_timer_resume();
drop function if exists public.fl_timer_stop(timestamptz);
drop function if exists public.fl_timer_discard();
drop function if exists public.fl_timer_undo_stop(uuid, text);
drop function if exists public.fl_admin_delete_user_data(uuid, boolean);
drop function if exists public.fl_handle_new_user();
drop function if exists public.fl_detach_moved_session();
drop function if exists public.fl_claim_example_on_session();
drop function if exists public.fl_claim_example_on_task();
drop function if exists public.fl_trim_name();
drop function if exists public.set_updated_at();

-- In the same transaction this was followed by the full text of
-- supabase/migrations/20261009000000_focus_log_schema.sql (unchanged), and the
-- platform then ran supabase/seed.sql.
