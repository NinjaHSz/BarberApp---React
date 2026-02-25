import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  if (process.env.NODE_ENV === "production") {
    console.error("CRITICAL: Supabase environment variables are missing!");
  }
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder-url.supabase.co", 
  supabaseKey || "placeholder-key"
);
