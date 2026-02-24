CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id TEXT UNIQUE NOT NULL, -- Clerk user ID
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Balances Table
CREATE TABLE IF NOT EXISTS public.balances (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  chip_balance BIGINT NOT NULL DEFAULT 10000,
  last_refill_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game History Table
CREATE TABLE IF NOT EXISTS public.game_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL, -- 'CASH' or 'TOURNAMENT'
  stake TEXT NOT NULL, -- e.g., '100/200'
  profit_loss BIGINT NOT NULL,
  stage_reached TEXT NOT NULL, -- e.g., 'SHOWDOWN', 'PREFLOP'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- MULTIPLAYER TABLES
-- ============================================================

-- Poker Tables (one row = one active game table, max 5)
CREATE TABLE IF NOT EXISTS public.poker_tables (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_number    INT NOT NULL CHECK (table_number BETWEEN 1 AND 5),
  status          TEXT NOT NULL DEFAULT 'waiting',  -- waiting|playing|closed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fill_deadline   TIMESTAMPTZ,   -- when to fill empty seats with AI
  hand_count      INT NOT NULL DEFAULT 0,
  game_state      JSONB NOT NULL DEFAULT '{}'::JSONB
);

-- Only one open table per table_number at a time
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_table
  ON public.poker_tables (table_number)
  WHERE status IN ('waiting', 'playing');

-- Table Players (one row = one seat at one table)
CREATE TABLE IF NOT EXISTS public.table_players (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id        UUID NOT NULL REFERENCES public.poker_tables(id) ON DELETE CASCADE,
  seat_index      INT NOT NULL CHECK (seat_index BETWEEN 0 AND 7),
  player_type     TEXT NOT NULL DEFAULT 'ai',  -- real|ai
  user_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  display_name    TEXT NOT NULL,
  avatar_url      TEXT,
  chip_balance    BIGINT NOT NULL DEFAULT 5000,
  hole_cards      JSONB,  -- Card[] (private)
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (table_id, seat_index)
);

-- Index for fast lookup of a user's current seat
CREATE INDEX IF NOT EXISTS idx_table_players_user ON public.table_players (user_id)
  WHERE player_type = 'real';

-- ============================================================
-- Disable Row Level Security (RLS) so the Next.js API can read/write without complex policies
-- ============================================================
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.poker_tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_players DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Enable Supabase Realtime on poker_tables for live state updates
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_tables;
