-- LDM Portal update 004: design cost proposals and the client journey.
-- Proposals are prepared by the owner, opened by the client through a private link,
-- accepted or declined, then turned into an onboarded project with its payment schedule.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.

-- 1. Proposals
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  proposal_no text not null default '',
  kind text not null default 'Design',
  title text not null default '',
  location text default '',
  client_name text default '',
  client_email text default '',
  client_phone text default '',
  proposal_date date not null default current_date,
  valid_days int not null default 30,
  total numeric(14, 2) not null default 0,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'onboarded')),
  sent_at timestamptz,
  responded_at timestamptz,
  accepted_name text default '',
  client_note text default '',
  project_id text references public.projects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.proposals enable row level security;
drop policy if exists "owner all proposals" on public.proposals;
create policy "owner all proposals" on public.proposals for all using (public.is_owner()) with check (public.is_owner());

create or replace function public.stamp_proposal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.status = 'sent' and (tg_op = 'INSERT' or old.status is distinct from 'sent') then new.sent_at := now(); end if;
  return new;
end $$;
drop trigger if exists proposals_stamp on public.proposals;
create trigger proposals_stamp before insert or update on public.proposals
  for each row execute function public.stamp_proposal();

-- 2. Payment schedule per project (from the accepted proposal); clients can see their own
create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  stage text not null default 'Design' check (stage in ('Design', 'Construction')),
  label text not null default '',
  milestone text default '',
  percent numeric(6, 2) not null default 0,
  amount numeric(14, 2) not null default 0,
  sort int not null default 0
);
alter table public.project_milestones enable row level security;
drop policy if exists "owner all milestones" on public.project_milestones;
drop policy if exists "client reads own milestones" on public.project_milestones;
create policy "owner all milestones" on public.project_milestones for all using (public.is_owner()) with check (public.is_owner());
create policy "client reads own milestones" on public.project_milestones for select
  using (public.my_role() = 'client' and public.is_member(project_id));

-- 3. The client's private link: view and respond without an account.
--    Only the person holding the link (a random code) can open it.
create or replace function public.proposal_by_token(t uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('proposal_no', proposal_no, 'kind', kind, 'title', title, 'location', location, 'client_name', client_name,
    'proposal_date', proposal_date, 'valid_days', valid_days, 'total', total, 'content', content, 'status', status,
    'responded_at', responded_at, 'accepted_name', accepted_name, 'client_note', client_note)
  from public.proposals where token = t and status <> 'draft'
$$;

create or replace function public.respond_proposal(t uuid, accept boolean, signer text, note text)
returns text language plpgsql security definer set search_path = public as $$
declare p public.proposals;
begin
  select * into p from public.proposals where token = t;
  if p.id is null or p.status = 'draft' then raise exception 'Proposal not found'; end if;
  if p.status <> 'sent' then raise exception 'This proposal has already been answered'; end if;
  if current_date > p.proposal_date + p.valid_days then raise exception 'This proposal has expired. Please contact LDM for an updated proposal.'; end if;
  if accept and coalesce(trim(signer), '') = '' then raise exception 'Please type your full name to accept'; end if;
  update public.proposals
     set status = case when accept then 'accepted' else 'declined' end, responded_at = now(),
         accepted_name = case when accept then left(trim(signer), 120) else '' end, client_note = left(coalesce(note, ''), 2000)
   where id = p.id;
  return case when accept then 'accepted' else 'declined' end;
end $$;

-- 4. Onboard: turn an accepted proposal into a project, with its payment schedule,
--    and link the client's account if they already have one.
create or replace function public.onboard_proposal(pid uuid, project_name text)
returns text language plpgsql security definer set search_path = public as $$
declare p public.proposals; new_id text; pay jsonb; i int := 0; uid uuid;
begin
  if not public.is_owner() then raise exception 'Only the owner can onboard clients'; end if;
  select * into p from public.proposals where id = pid;
  if p.id is null then raise exception 'Proposal not found'; end if;
  if p.project_id is not null then return p.project_id; end if;
  new_id := 'p-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  insert into public.projects (id, name, client_name, contact, scope, location, status, phase, onboard_date, start_date, notes)
  values (new_id, coalesce(nullif(trim(project_name), ''), p.title), p.client_name, concat_ws(' · ', nullif(p.client_email, ''), nullif(p.client_phone, '')),
          p.title, p.location, 'Onboarded', 'Design', current_date, current_date, 'From design proposal ' || p.proposal_no);
  insert into public.project_finance (project_id, design_contract) values (new_id, p.total);
  for pay in select * from jsonb_array_elements(coalesce(p.content -> 'payments', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.project_milestones (project_id, stage, label, milestone, percent, amount, sort)
    values (new_id, 'Design', coalesce(pay ->> 'label', ''), coalesce(pay ->> 'milestone', ''), coalesce((pay ->> 'pct')::numeric, 0),
            round(p.total * coalesce((pay ->> 'pct')::numeric, 0) / 100, 2), i);
  end loop;
  update public.proposals set status = 'onboarded', project_id = new_id where id = p.id;
  if coalesce(p.client_email, '') <> '' then
    select id into uid from public.profiles where lower(email) = lower(p.client_email) limit 1;
    if uid is not null then
      update public.profiles set role = 'client' where id = uid and role = 'pending';
      insert into public.project_members (project_id, user_id) values (new_id, uid) on conflict do nothing;
    end if;
  end if;
  return new_id;
end $$;

-- 5. A client who signs up later with the proposal's email is linked automatically.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare pr record; linked boolean := false;
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when exists (select 1 from public.profiles where role = 'owner') then 'pending'::public.app_role else 'owner'::public.app_role end
  );
  for pr in select project_id from public.proposals
            where project_id is not null and coalesce(client_email, '') <> '' and lower(client_email) = lower(new.email) loop
    insert into public.project_members (project_id, user_id) values (pr.project_id, new.id) on conflict do nothing;
    linked := true;
  end loop;
  if linked then update public.profiles set role = 'client' where id = new.id and role = 'pending'; end if;
  return new;
end $$;

-- 6. Clients can read the proposal they accepted.
create or replace function public.client_proposals()
returns table (id uuid, project_id text, proposal_no text, title text, location text, client_name text, proposal_date date,
               valid_days int, total numeric, content jsonb, status text, responded_at timestamptz, accepted_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.project_id, p.proposal_no, p.title, p.location, p.client_name, p.proposal_date, p.valid_days, p.total, p.content, p.status, p.responded_at, p.accepted_name
  from public.proposals p
  where p.project_id is not null and public.my_role() = 'client' and public.is_member(p.project_id)
$$;

grant select, insert, update, delete on public.proposals, public.project_milestones to authenticated;
grant execute on function public.proposal_by_token(uuid), public.respond_proposal(uuid, boolean, text, text) to anon, authenticated;
grant execute on function public.onboard_proposal(uuid, text), public.client_proposals() to authenticated;
