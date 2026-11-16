-- ============================================================
-- Auravine Database Schema (Supabase / PostgreSQL)
-- Run this inside the Supabase SQL Editor
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.flowers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  recipient_name text not null check (char_length(trim(recipient_name)) between 1 and 80),
  secret_message text not null check (char_length(secret_message) <= 150),
  primary_color text not null default '#a855f7',
  secondary_color text not null default '#38bdf8',
  flower_style text not null default 'lily',
  created_at timestamptz not null default now()
);

-- Fast lookup by unique gift slug
create index if not exists idx_flowers_slug on public.flowers (slug);

-- Enable Row Level Security (RLS)
alter table public.flowers enable row level security;

-- Allow anyone to view a flower gift by its link
create policy "Anyone can read flowers"
  on public.flowers
  for select
  using (true);

-- Allow anyone to create a new flower gift
create policy "Anyone can insert flowers"
  on public.flowers
  for insert
  with check (
    char_length(trim(recipient_name)) between 1 and 80
    and char_length(secret_message) <= 150
  );
