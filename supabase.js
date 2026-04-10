// ── Supabase client configuration ──
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL  = 'https://tvppkzkqrodrkxemxnvi.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2cHBremtxcm9kcmt4ZW14bnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MzcxODQsImV4cCI6MjA5MTExMzE4NH0.Z70otGFaOER5KNj2yc7Wk5nl1KiIvKHuFSXHBMnAdUA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
