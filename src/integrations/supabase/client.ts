
// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://bpyzpnioddmzniuikbsn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweXpwbmlvZGRtem5pdWlrYnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3ODE0MzksImV4cCI6MjA1NzM1NzQzOX0.UEdE77tebNbCdJkmX0RyNpKVp3mWhTL-hekMVNcPuIg";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
