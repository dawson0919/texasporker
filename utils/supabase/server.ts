import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// A single Supabase instance for use in server components/actions since Clerk handles authentication.
export const supabase = createClient(supabaseUrl, supabaseKey);
