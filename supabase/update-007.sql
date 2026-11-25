-- LDM Portal update 007: construction proposals are ball park figures.
-- 1. A design proposal can carry a construction ball park estimate in the same client link.
--    The client accepts the design proposal and acknowledges the ball park estimate.
-- 2. Onboarding never creates a construction payment schedule or construction contract from a
--    ball park estimate. Only design and services payments are created; the construction contract
--    is set after the design is finished.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.

alter table public.proposals add column if not exists ballpark_id uuid references public.proposals (id) on delete set null;

-- The client's link returns the attached ball park estimate too
create or replace function public.proposal_by_token(t uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('proposal_no', p.proposal_no, 'kind', p.kind, 'title', p.title, 'location', p.location, 'client_name', p.client_name,
    'proposal_date', p.proposal_date, 'valid_days', p.valid_days, 'total', p.total, 'content', p.content, 'status', p.status,
    'responded_at', p.responded_at, 'accepted_name', p.accepted_name, 'client_note', p.client_note,
    'ballpark', (select jsonb_build_object('proposal_no', b.proposal_no, 'kind', b.kind, 'title', b.title, 'location', b.location, 'client_name', b.client_name,
        'proposal_date', b.proposal_date, 'valid_days', b.valid_days, 'total', b.total, 'content', b.content, 'status', b.status,
        'responded_at', b.responded_at, 'accepted_name', b.accepted_name)
      from public.proposals b where b.id = p.ballpark_id))
  from public.proposals p where p.token = t and p.status <> 'draft'
$$;

-- Accepting (or declining) the design proposal records the same answer on its ball park estimate
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
   where id = p.id or (p.ballpark_id is not null and id = p.ballpark_id and project_id is null);
  return case when accept then 'accepted' else 'declined' end;
end $$;

-- Onboard: design and services payments only. A ball park construction figure is kept in the notes.
create or replace function public.onboard_proposal(pid uuid, project_name text)
returns text language plpgsql security definer set search_path = public as $$
declare p public.proposals; b public.proposals; new_id text; pay jsonb; i int := 0; uid uuid; has_ms boolean; bp numeric := 0; bp_no text := '';
begin
  if not public.is_owner() then raise exception 'Only the owner can onboard clients'; end if;
  select * into p from public.proposals where id = pid;
  if p.id is null then raise exception 'Proposal not found'; end if;
  if p.project_id is not null then return p.project_id; end if;
  if p.ballpark_id is not null then select * into b from public.proposals where id = p.ballpark_id; end if;
  has_ms := jsonb_typeof(p.content -> 'milestones') = 'array';
  if p.kind = 'Construction' then
    bp := coalesce((p.content -> 'finance' ->> 'construction')::numeric, 0); bp_no := p.proposal_no;
  elsif b.id is not null then
    bp := coalesce((b.content -> 'finance' ->> 'construction')::numeric, 0); bp_no := b.proposal_no;
  end if;
  new_id := 'p-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  insert into public.projects (id, name, client_name, contact, scope, location, status, phase, onboard_date, start_date, notes)
  values (new_id, coalesce(nullif(trim(project_name), ''), p.title), p.client_name, concat_ws(' · ', nullif(p.client_email, ''), nullif(p.client_phone, '')),
          p.title, p.location, 'Onboarded', 'Design', current_date, current_date,
          'From ' || lower(p.kind) || ' proposal ' || p.proposal_no ||
          case when bp > 0 then '. Construction ball park estimate ' || to_char(bp, 'FM999,999,999,990.00') || ' (' || bp_no || '), to be finalized after the design.' else '' end);
  if has_ms and p.content ? 'finance' then
    insert into public.project_finance (project_id, design_contract, construction_contract)
    values (new_id, coalesce((p.content -> 'finance' ->> 'design')::numeric, 0), 0);
  else
    insert into public.project_finance (project_id, design_contract, construction_contract) values (new_id, p.total, 0);
  end if;
  if has_ms then
    for pay in select * from jsonb_array_elements(p.content -> 'milestones') loop
      continue when pay ->> 'stage' = 'Construction';
      i := i + 1;
      insert into public.project_milestones (project_id, stage, label, milestone, percent, amount, sort)
      values (new_id, 'Design', coalesce(pay ->> 'label', ''), coalesce(pay ->> 'milestone', ''),
              coalesce((pay ->> 'pct')::numeric, 0), coalesce((pay ->> 'amount')::numeric, 0), i);
    end loop;
  else
    for pay in select * from jsonb_array_elements(coalesce(p.content -> 'payments', '[]'::jsonb)) loop
      i := i + 1;
      insert into public.project_milestones (project_id, stage, label, milestone, percent, amount, sort)
      values (new_id, 'Design', coalesce(pay ->> 'label', ''), coalesce(pay ->> 'milestone', ''), coalesce((pay ->> 'pct')::numeric, 0),
              round(p.total * coalesce((pay ->> 'pct')::numeric, 0) / 100, 2), i);
    end loop;
  end if;
  update public.proposals set status = 'onboarded', project_id = new_id where id = p.id;
  if b.id is not null then update public.proposals set status = 'onboarded', project_id = new_id where id = b.id and project_id is null; end if;
  if coalesce(p.client_email, '') <> '' then
    select id into uid from public.profiles where lower(email) = lower(p.client_email) limit 1;
    if uid is not null then
      update public.profiles set role = 'client' where id = uid and role = 'pending';
      insert into public.project_members (project_id, user_id) values (new_id, uid) on conflict do nothing;
    end if;
  end if;
  return new_id;
end $$;

grant execute on function public.proposal_by_token(uuid), public.respond_proposal(uuid, boolean, text, text) to anon, authenticated;
grant execute on function public.onboard_proposal(uuid, text) to authenticated;
