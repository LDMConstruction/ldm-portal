-- Your current projects from the LDM Project Hub (as of Nov 16, 2026).
-- Run once, after schema.sql. Contract amounts are entered as construction contract;
-- split out the design part in the portal if needed.
insert into public.projects (id, name, client_name, scope, location, status, phase, progress, phase_progress, phases_na,
  onboard_date, start_date, mobilization_date, end_date, lat, lng, notes) values
('p-sereno', 'Sereno Residence', 'Spouses Emil Peralta Sereno & Karen Dayrit Suarez', '145 sqm two storey residential',
  'Brgy. Kabulusan, General Emilio Aguinaldo, Cavite', 'Onboarded', 'Permitting', 0, '{}', '{}',
  '2026-09-10', '2026-09-10', '2027-01-18', '2027-10-30', 14.1798, 120.8143, 'Contract proposal prepared Nov 2026. Fence and garage excluded.'),
('p-delica', 'Delica Residence', 'Elijohn Delica', '70 sqm two storey residential',
  'Le Joya de Sta. Rosa Village, Sta. Rosa, Laguna (80 sqm lot)', 'Onboarded', 'Design', 0, '{}', '{}',
  '2026-11-23', '2026-11-23', '2027-02-15', '2027-10-31', 14.312, 121.112, 'Design phase from third week of Nov 2026, then permitting and construction.'),
('p-west-ayala', 'West of Ayala Interior Renovation', 'Alvin Bagasan', '265 sqm interior renovation',
  'West of Ayala Condominiums, Makati City', 'Onboarded', 'Design', 1,
  '{"Design":10,"Permitting":0,"Mobilization":0,"Demolition":0,"Structural":0,"Roofing & Masonry":0,"MEPF Roughing":0,"Finishing":0,"Punchlist":0,"Turnover":0}', '{}',
  '2026-10-15', '2026-10-15', '2027-01-18', '2027-07-30', 14.5585, 121.0155, 'Mobilization 3rd week of January 2027.'),
('p-palm-beach', 'Palm Beach Interior Renovation', 'Sir Ken', '30 sqm interior renovation',
  'Siargao Tower, Palm Beach Residences, Pasay City', 'Onboarded', 'Permitting', 0, '{}', '{}',
  '2026-08-28', '2026-08-28', '2027-01-04', '2027-02-28', 14.531, 120.984, 'Mobilization 2nd week of January 2027.');

insert into public.project_finance (project_id, design_contract, construction_contract, design_cost, direct_cost) values
('p-sereno', 0, 5995074.72, 0, 0),
('p-delica', 0, 3500000, 0, 0),
('p-west-ayala', 0, 6000000, 0, 0),
('p-palm-beach', 0, 998189.23, 0, 0);
