-- LDM Portal update 005: construction cost proposals.
-- Onboarding a construction proposal sets both the design (services) and construction contracts,
-- and copies its full cost schedule (design, permit, downpayment, progress billings, post construction).
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.

create or replace function public.onboard_proposal(pid uuid, project_name text)
returns text language plpgsql security definer set search_path = public as $$
declare p public.proposals; new_id text; pay jsonb; i int := 0; uid uuid; has_ms boolean;
begin
  if not public.is_owner() then raise exception 'Only the owner can onboard clients'; end if;
  select * into p from public.proposals where id = pid;
  if p.id is null then raise exception 'Proposal not found'; end if;
  if p.project_id is not null then return p.project_id; end if;
  has_ms := jsonb_typeof(p.content -> 'milestones') = 'array';
  new_id := 'p-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  insert into public.projects (id, name, client_name, contact, scope, location, status, phase, onboard_date, start_date, notes)
  values (new_id, coalesce(nullif(trim(project_name), ''), p.title), p.client_name, concat_ws(' · ', nullif(p.client_email, ''), nullif(p.client_phone, '')),
          p.title, p.location, 'Onboarded', 'Design', current_date, current_date, 'From ' || lower(p.kind) || ' proposal ' || p.proposal_no);
  if has_ms and p.content ? 'finance' then
    insert into public.project_finance (project_id, design_contract, construction_contract)
    values (new_id, coalesce((p.content -> 'finance' ->> 'design')::numeric, 0), coalesce((p.content -> 'finance' ->> 'construction')::numeric, 0));
  else
    insert into public.project_finance (project_id, design_contract) values (new_id, p.total);
  end if;
  if has_ms then
    for pay in select * from jsonb_array_elements(p.content -> 'milestones') loop
      i := i + 1;
      insert into public.project_milestones (project_id, stage, label, milestone, percent, amount, sort)
      values (new_id, case when pay ->> 'stage' = 'Construction' then 'Construction' else 'Design' end, coalesce(pay ->> 'label', ''), coalesce(pay ->> 'milestone', ''),
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
  if coalesce(p.client_email, '') <> '' then
    select id into uid from public.profiles where lower(email) = lower(p.client_email) limit 1;
    if uid is not null then
      update public.profiles set role = 'client' where id = uid and role = 'pending';
      insert into public.project_members (project_id, user_id) values (new_id, uid) on conflict do nothing;
    end if;
  end if;
  return new_id;
end $$;

drop function if exists public.client_proposals();
create function public.client_proposals()
returns table (id uuid, project_id text, proposal_no text, kind text, title text, location text, client_name text, proposal_date date,
               valid_days int, total numeric, content jsonb, status text, responded_at timestamptz, accepted_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.project_id, p.proposal_no, p.kind, p.title, p.location, p.client_name, p.proposal_date, p.valid_days, p.total, p.content, p.status, p.responded_at, p.accepted_name
  from public.proposals p
  where p.project_id is not null and public.my_role() = 'client' and public.is_member(p.project_id)
$$;
grant execute on function public.onboard_proposal(uuid, text), public.client_proposals() to authenticated;
