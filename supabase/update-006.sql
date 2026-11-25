-- LDM Portal update 006: payment requests.
-- The payment schedule stays private to LDM. A payment shows on the client's account
-- only after the owner requests it, and is marked paid when the payment is recorded.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.

alter table public.project_milestones
  add column if not exists status text not null default 'scheduled',
  add column if not exists due_date date,
  add column if not exists requested_at timestamptz,
  add column if not exists request_note text not null default '',
  add column if not exists paid_at timestamptz;
alter table public.project_milestones drop constraint if exists project_milestones_status_check;
alter table public.project_milestones add constraint project_milestones_status_check check (status in ('scheduled', 'requested', 'paid'));

drop policy if exists "client reads own milestones" on public.project_milestones;
drop policy if exists "client reads requested payments" on public.project_milestones;
create policy "client reads requested payments" on public.project_milestones for select
  using (public.my_role() = 'client' and public.is_member(project_id) and status <> 'scheduled');
