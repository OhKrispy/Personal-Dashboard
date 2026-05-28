-- Run this in your Supabase SQL editor to create all tables

create table if not exists metrics (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  weight numeric,
  work_hours numeric,
  sleep_hours numeric,
  study_hours numeric,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(date)
);

create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  category text not null,
  amount numeric not null,
  created_at timestamp with time zone default now()
);

create table if not exists activities (
  id uuid default gen_random_uuid() primary key,
  date date not null unique,
  gym boolean default false,
  basketball boolean default false,
  athletic_work boolean default false,
  skincare boolean default false,
  reading boolean default false,
  room_cleaning boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists notes (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  text text not null,
  created_at timestamp with time zone default now()
);

create table if not exists remarks (
  id uuid default gen_random_uuid() primary key,
  date date not null unique,
  text text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- If you already ran the old schema, just add the new column:
-- alter table activities add column if not exists room_cleaning boolean default false;

-- Enable Row Level Security
alter table metrics enable row level security;
alter table expenses enable row level security;
alter table activities enable row level security;
alter table notes enable row level security;
alter table remarks enable row level security;

-- Allow all access (single user dashboard)
create policy "Allow all" on metrics for all using (true) with check (true);
create policy "Allow all" on expenses for all using (true) with check (true);
create policy "Allow all" on activities for all using (true) with check (true);
create policy "Allow all" on notes for all using (true) with check (true);
create policy "Allow all" on remarks for all using (true) with check (true);

-- Calories table (run this if adding calorie tracker to existing setup)
create table if not exists calories (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  item text not null,
  amount numeric not null,
  created_at timestamp with time zone default now()
);

alter table calories enable row level security;
create policy "Allow all" on calories for all using (true) with check (true);
