-- LDM Portal update 008: your design fee computation (floor area x rates, minimums, sheets)
-- is saved with the proposal for you only. The client's link never returns it.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
alter table public.proposals add column if not exists calc jsonb;
