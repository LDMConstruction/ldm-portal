-- LDM Portal update 003: progress billing in the LDM letter and General Construction Report format.
-- Adds company and bank details for the letterhead, and attention / salutation on each billing.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.

alter table public.settings
  add column if not exists company_name text not null default 'LDM Design & Build',
  add column if not exists company_address text not null default E'2F Mandaue Foam Building, Shaw Boulevard\nAddition Hills, Mandaluyong City',
  add column if not exists company_contact text not null default '(+63) 945 681 0515',
  add column if not exists company_email text not null default 'ldmengineeringdesign@gmail.com',
  add column if not exists signatory text not null default 'Engr. Lester D. Miranda',
  add column if not exists signatory_title text not null default 'Project Engineer',
  add column if not exists bank_name text not null default 'EASTWEST BANK (Checking)',
  add column if not exists bank_account_name text not null default 'LESTER MIRANDA',
  add column if not exists bank_account_no text not null default '200059453326';

alter table public.progress_billings
  add column if not exists attention text not null default '',
  add column if not exists salutation text not null default 'Dear Sir/Ma''am,';
