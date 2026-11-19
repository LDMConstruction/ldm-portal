-- LDM Project Portal: database schema and access rules
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Roles: owner (full access), employee (assigned projects only, no money),
-- client (own project only: progress, payments, approved reports), pending (no access yet).

-- ---------------------------------------------------------------- profiles
create type public.app_role as enum ('owner', 'employee', 'client', 'pending');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text default '',
  role public.app_role not null default 'pending',
  created_at timestamptz not null default now()
);

-- First account ever created becomes the owner; everyone after starts as pending.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when exists (select 1 from public.profiles where role = 'owner') then 'pending'::public.app_role else 'owner'::public.app_role end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.my_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'owner' from public.profiles where id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------- projects
create table public.projects (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  client_name text default '',
  contact text default '',
  scope text default '',
  location text default '',
  status text not null default 'Onboarded'
    check (status in ('Proposal', 'Onboarded', 'Ongoing', 'On Hold', 'Completed', 'Unconfirmed')),
  phase text default '',
  progress int not null default 0,
  phase_progress jsonb not null default '{}'::jsonb,
  phases_na text[] not null default '{}',
  onboard_date date,
  start_date date,
  mobilization_date date,
  end_date date,
  lat double precision,
  lng double precision,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id text not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (project_id, user_id)
);

create function public.is_member(pid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = pid and user_id = auth.uid())
$$;

-- Money for each project. Owner only; clients get their totals through client_summary().
create table public.project_finance (
  project_id text primary key references public.projects (id) on delete cascade,
  design_contract numeric(14, 2) not null default 0,
  construction_contract numeric(14, 2) not null default 0,
  design_cost numeric(14, 2) not null default 0,
  direct_cost numeric(14, 2) not null default 0
);

-- Employees may only change progress fields on projects they are assigned to.
create function public.guard_project_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if public.is_owner() then return new; end if;
  if (to_jsonb(new) - array['phase', 'progress', 'phase_progress', 'phases_na', 'updated_at'])
     is distinct from (to_jsonb(old) - array['phase', 'progress', 'phase_progress', 'phases_na', 'updated_at']) then
    raise exception 'Only progress can be updated from this account';
  end if;
  return new;
end $$;

create trigger projects_guard before update on public.projects
  for each row execute function public.guard_project_update();

-- ---------------------------------------------------------------- costs
create table public.costs (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  date date not null default current_date,
  stage text not null default 'Construction' check (stage in ('Design', 'Construction')),
  category text not null default 'Materials',
  amount numeric(14, 2) not null check (amount >= 0),
  description text default '',
  paid_from text not null default 'company' check (paid_from in ('company', 'petty_cash', 'out_of_pocket')),
  reimbursed boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- Employees cannot mark their own out of pocket expenses as reimbursed.
create function public.guard_cost_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_owner() then return new; end if;
  new.created_by := auth.uid();
  if tg_op = 'INSERT' then new.reimbursed := false;
  else new.reimbursed := old.reimbursed; end if;
  if new.paid_from = 'company' then new.paid_from := 'petty_cash'; end if;
  return new;
end $$;

create trigger costs_guard before insert or update on public.costs
  for each row execute function public.guard_cost_write();

-- Petty cash an employee received (from LDM, for their projects).
create table public.petty_cash (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  project_id text references public.projects (id) on delete set null,
  date date not null default current_date,
  amount numeric(14, 2) not null check (amount > 0),
  note text default '',
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- collections
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  date date not null default current_date,
  amount numeric(14, 2) not null check (amount >= 0),
  stage text not null default 'Construction' check (stage in ('Design', 'Construction')),
  type text default 'Downpayment',
  reference text default '',
  mode text default 'Bank transfer',
  notes text default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- weekly reports
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  week_start date not null,
  week_end date not null,
  manpower text default '',
  weather text default '',
  activities text default '',
  next_week text default '',
  issues text default '',
  progress_snapshot int,
  phase_snapshot text default '',
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'returned')),
  owner_note text default '',
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Employees can save drafts and submit; only the owner approves or returns.
create function public.guard_report_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if public.is_owner() then
    if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
      new.approved_at := now(); new.approved_by := auth.uid();
    end if;
    return new;
  end if;
  new.created_by := coalesce(old.created_by, auth.uid());
  if new.status not in ('draft', 'submitted') then raise exception 'Reports are approved by LDM'; end if;
  if tg_op = 'UPDATE' then
    new.owner_note := old.owner_note; new.approved_at := old.approved_at; new.approved_by := old.approved_by;
  else
    new.owner_note := ''; new.approved_at := null; new.approved_by := null;
  end if;
  if new.status = 'submitted' then new.submitted_at := now(); end if;
  return new;
end $$;

create trigger reports_guard before insert or update on public.reports
  for each row execute function public.guard_report_write();

create table public.report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  path text not null,
  caption text default '',
  sort int not null default 0,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- settings
create table public.settings (
  id int primary key default 1 check (id = 1),
  capacity int not null default 5,
  assumed_months int not null default 6,
  release_months int not null default 2
);
insert into public.settings (id) values (1);

-- ---------------------------------------------------------------- client summary
-- Clients see only their contract total and what they have paid, never costs.
create function public.client_summary()
returns table (project_id text, contract numeric, design_contract numeric, construction_contract numeric, paid numeric)
language sql stable security definer set search_path = public as $$
  select p.id,
         coalesce(f.design_contract, 0) + coalesce(f.construction_contract, 0),
         coalesce(f.design_contract, 0), coalesce(f.construction_contract, 0),
         coalesce((select sum(c.amount) from public.collections c where c.project_id = p.id), 0)
  from public.projects p
  left join public.project_finance f on f.project_id = p.id
  where public.is_owner() or (public.my_role() = 'client' and public.is_member(p.id))
$$;

-- Names of teammates for report bylines (no emails or roles exposed).
create function public.people_names()
returns table (id uuid, full_name text)
language sql stable security definer set search_path = public as $$
  select id, coalesce(nullif(full_name, ''), split_part(email, '@', 1)) from public.profiles
  where auth.uid() is not null and role <> 'pending'
$$;

-- ---------------------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_finance enable row level security;
alter table public.costs enable row level security;
alter table public.petty_cash enable row level security;
alter table public.collections enable row level security;
alter table public.reports enable row level security;
alter table public.report_photos enable row level security;
alter table public.settings enable row level security;

-- profiles
create policy "read own profile or owner reads all" on public.profiles for select
  using (id = auth.uid() or public.is_owner());
create policy "owner manages profiles" on public.profiles for update
  using (public.is_owner()) with check (public.is_owner());
create policy "owner removes profiles" on public.profiles for delete using (public.is_owner());

-- projects
create policy "owner or members read projects" on public.projects for select
  using (public.is_owner() or public.is_member(id));
create policy "owner adds projects" on public.projects for insert with check (public.is_owner());
create policy "owner and assigned employees update" on public.projects for update
  using (public.is_owner() or (public.my_role() = 'employee' and public.is_member(id)))
  with check (public.is_owner() or (public.my_role() = 'employee' and public.is_member(id)));
create policy "owner deletes projects" on public.projects for delete using (public.is_owner());

-- project members
create policy "owner manages members" on public.project_members for all
  using (public.is_owner()) with check (public.is_owner());
create policy "see own memberships" on public.project_members for select using (user_id = auth.uid());

-- finance: owner only
create policy "owner only finance" on public.project_finance for all
  using (public.is_owner()) with check (public.is_owner());

-- costs
create policy "owner all costs" on public.costs for all using (public.is_owner()) with check (public.is_owner());
create policy "employee reads own costs" on public.costs for select
  using (public.my_role() = 'employee' and created_by = auth.uid());
create policy "employee adds costs on assigned projects" on public.costs for insert
  with check (public.my_role() = 'employee' and public.is_member(project_id));
create policy "employee edits own unreimbursed costs" on public.costs for update
  using (public.my_role() = 'employee' and created_by = auth.uid() and reimbursed = false)
  with check (public.my_role() = 'employee' and public.is_member(project_id));
create policy "employee deletes own unreimbursed costs" on public.costs for delete
  using (public.my_role() = 'employee' and created_by = auth.uid() and reimbursed = false);

-- petty cash
create policy "owner all petty cash" on public.petty_cash for all using (public.is_owner()) with check (public.is_owner());
create policy "employee reads own petty cash" on public.petty_cash for select
  using (public.my_role() = 'employee' and employee_id = auth.uid());
create policy "employee records cash received" on public.petty_cash for insert
  with check (public.my_role() = 'employee' and employee_id = auth.uid()
              and (project_id is null or public.is_member(project_id)));
create policy "employee fixes own entries" on public.petty_cash for update
  using (public.my_role() = 'employee' and employee_id = auth.uid() and created_by = auth.uid())
  with check (public.my_role() = 'employee' and employee_id = auth.uid());
create policy "employee deletes own entries" on public.petty_cash for delete
  using (public.my_role() = 'employee' and employee_id = auth.uid() and created_by = auth.uid());

-- collections
create policy "owner all collections" on public.collections for all using (public.is_owner()) with check (public.is_owner());
create policy "client reads own payments" on public.collections for select
  using (public.my_role() = 'client' and public.is_member(project_id));

-- reports
create policy "owner all reports" on public.reports for all using (public.is_owner()) with check (public.is_owner());
create policy "employees read reports on assigned projects" on public.reports for select
  using (public.my_role() = 'employee' and public.is_member(project_id));
create policy "client reads approved reports" on public.reports for select
  using (public.my_role() = 'client' and public.is_member(project_id) and status = 'approved');
create policy "employee creates reports" on public.reports for insert
  with check (public.my_role() = 'employee' and public.is_member(project_id));
create policy "employee edits own draft or returned" on public.reports for update
  using (public.my_role() = 'employee' and created_by = auth.uid() and status in ('draft', 'returned'))
  with check (public.my_role() = 'employee' and public.is_member(project_id));
create policy "employee deletes own drafts" on public.reports for delete
  using (public.my_role() = 'employee' and created_by = auth.uid() and status in ('draft', 'returned'));

-- report photos (visibility follows the report)
create policy "read photos of visible reports" on public.report_photos for select
  using (exists (select 1 from public.reports r where r.id = report_id));
create policy "owner all photos" on public.report_photos for all using (public.is_owner()) with check (public.is_owner());
create policy "employee adds photos to own open report" on public.report_photos for insert
  with check (exists (select 1 from public.reports r where r.id = report_id and r.created_by = auth.uid()
                      and r.status in ('draft', 'returned')));
create policy "employee removes photos from own open report" on public.report_photos for delete
  using (exists (select 1 from public.reports r where r.id = report_id and r.created_by = auth.uid()
                 and r.status in ('draft', 'returned')));

-- settings
create policy "signed in read settings" on public.settings for select using (auth.uid() is not null);
create policy "owner updates settings" on public.settings for update using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------- photo storage
insert into storage.buckets (id, name, public) values ('report-photos', 'report-photos', false)
  on conflict (id) do nothing;

create policy "read photos of visible reports" on storage.objects for select
  using (bucket_id = 'report-photos'
         and exists (select 1 from public.reports r where r.id::text = (storage.foldername(name))[1]));
create policy "upload photos to own open report" on storage.objects for insert
  with check (bucket_id = 'report-photos'
              and exists (select 1 from public.reports r where r.id::text = (storage.foldername(name))[1]
                          and (public.is_owner() or (r.created_by = auth.uid() and r.status in ('draft', 'returned')))));
create policy "delete photos from own open report" on storage.objects for delete
  using (bucket_id = 'report-photos'
         and exists (select 1 from public.reports r where r.id::text = (storage.foldername(name))[1]
                     and (public.is_owner() or (r.created_by = auth.uid() and r.status in ('draft', 'returned')))));

-- ---------------------------------------------------------------- grants
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke all on all tables in schema public from anon;
