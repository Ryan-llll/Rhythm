-- Create habits table
create table if not exists public.habits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  category text not null,
  color text not null,
  frequency_type text not null, -- 'daily', 'weekly', 'interval'
  frequency_days_of_week integer[], -- e.g., [1,2,3,4,5] (0 = Sunday, 1 = Monday, etc.)
  frequency_interval_days integer, -- e.g., 3 for every 3 days
  times_per_day integer default 1 not null,
  slot_names text[], -- e.g., ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
  reminder_time text, -- e.g. "14:00"
  created_at timestamp with time zone default now() not null
);

-- Create completions table
create table if not exists public.completions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  habit_id uuid references public.habits(id) on delete cascade not null,
  date date not null, -- YYYY-MM-DD format
  count integer default 0 not null,
  slots boolean[], -- e.g., [true, false, true, false, false]
  created_at timestamp with time zone default now() not null,
  unique (habit_id, date)
);

-- Enable Row Level Security (RLS) on both tables
alter table public.habits enable row level security;
alter table public.completions enable row level security;

-- Create policies for habits table
create policy "Users can perform all actions on their own habits"
  on public.habits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Create policies for completions table
create policy "Users can perform all actions on their own completions"
  on public.completions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
