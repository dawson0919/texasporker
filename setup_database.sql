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

-- Disable Row Level Security (RLS) so the Next.js API can read/write without complex policies
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_history DISABLE ROW LEVEL SECURITY;
