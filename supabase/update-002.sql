-- LDM Portal update 002 (Nov 2026)
-- Adds: Terminated status, Paid from Company and Client on expenses,
-- client reimbursements on the client's account, and progress billing with client acceptance.
-- Run once in Supabase: SQL Editor > New query > paste > Run.

-- 1. Terminated project status
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check
  check (status in ('Proposal', 'Onboarded', 'Ongoing', 'On Hold', 'Completed', 'Terminated', 'Unconfirmed'));

-- 2. Who paid for an expense: company, petty cash, out of pocket, or the client.
--    Employees may now choose Company or Client. They still can't mark anything reimbursed.
alter table public.costs drop constraint if exists costs_paid_from_check;
alter table public.costs add constraint costs_paid_from_check
  check (paid_from in ('company', 'petty_cash', 'out_of_pocket', 'client'));

create or replace function public.guard_cost_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_owner() then return new; end if;
  new.created_by := auth.uid();
  if tg_op = 'INSERT' then new.reimbursed := false;
  else new.reimbursed := old.reimbursed; end if;
  return new;
end $$;

-- 3. Expenses the client paid for are reimbursed by LDM, and the client sees them on their account.
drop policy if exists "client reads reimbursable costs" on public.costs;
create policy "client reads reimbursable costs" on public.costs for select
  using (public.my_role() = 'client' and public.is_member(project_id) and paid_from = 'client');

-- 4. Progress billing
create table if not exists public.progress_billings (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  billing_no int not null default 1,
  basis text not null default 'Construction' check (basis in ('Construction', 'Design', 'Total')),
  as_of date not null default current_date,
  period_start date,
  period_end date,
  contract_amount numeric(14, 2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  dp_percent numeric(6, 2) not null default 0,
  retention_percent numeric(6, 2) not null default 0,
  gross_to_date numeric(14, 2) not null default 0,
  net_to_date numeric(14, 2) not null default 0,
  previous_net numeric(14, 2) not null default 0,
  amount_due numeric(14, 2) not null default 0,
  notes text default '',
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'disputed')),
  client_note text default '',
  sent_at timestamptz,
  responded_at timestamptz,
  responded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.progress_billings enable row level security;
drop policy if exists "owner all billings" on public.progress_billings;
drop policy if exists "client reads sent billings" on public.progress_billings;
create policy "owner all billings" on public.progress_billings for all
  using (public.is_owner()) with check (public.is_owner());
create policy "client reads sent billings" on public.progress_billings for select
  using (public.my_role() = 'client' and public.is_member(project_id) and status <> 'draft');

create or replace function public.stamp_billing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.status = 'sent' and (tg_op = 'INSERT' or old.status is distinct from 'sent') then
    new.sent_at := now(); new.client_note := ''; new.responded_at := null; new.responded_by := null;
  end if;
  return new;
end $$;
drop trigger if exists billings_stamp on public.progress_billings;
create trigger billings_stamp before insert or update on public.progress_billings
  for each row execute function public.stamp_billing();

-- Clients accept a billing or raise a concern; nothing else about it can be changed by them.
create or replace function public.respond_billing(bid uuid, accept boolean, note text)
returns void language plpgsql security definer set search_path = public as $$
declare b public.progress_billings;
begin
  select * into b from public.progress_billings where id = bid;
  if b.id is null or public.my_role() <> 'client' or not public.is_member(b.project_id) then
    raise exception 'Billing not found';
  end if;
  if b.status <> 'sent' then raise exception 'This billing is no longer waiting for a response'; end if;
  update public.progress_billings
     set status = case when accept then 'accepted' else 'disputed' end,
         client_note = coalesce(note, ''), responded_at = now(), responded_by = auth.uid(), updated_at = now()
   where id = bid;
end $$;

-- Client totals now include reimbursements
drop function if exists public.client_summary();
create function public.client_summary()
returns table (project_id text, contract numeric, design_contract numeric, construction_contract numeric,
               paid numeric, reimbursed numeric, reimbursement_pending numeric)
language sql stable security definer set search_path = public as $$
  select p.id,
         coalesce(f.design_contract, 0) + coalesce(f.construction_contract, 0),
         coalesce(f.design_contract, 0), coalesce(f.construction_contract, 0),
         coalesce((select sum(c.amount) from public.collections c where c.project_id = p.id), 0),
         coalesce((select sum(k.amount) from public.costs k where k.project_id = p.id and k.paid_from = 'client' and k.reimbursed), 0),
         coalesce((select sum(k.amount) from public.costs k where k.project_id = p.id and k.paid_from = 'client' and not k.reimbursed), 0)
  from public.projects p
  left join public.project_finance f on f.project_id = p.id
  where public.is_owner() or (public.my_role() = 'client' and public.is_member(p.id))
$$;

grant select, insert, update, delete on public.progress_billings to authenticated;
grant execute on function public.respond_billing(uuid, boolean, text), public.client_summary() to authenticated;
