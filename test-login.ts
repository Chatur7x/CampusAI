import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE env vars.");
  process.exit(1);
}

const supabase = createClient(url, key);

async function testSignIn() {
  console.log("Testing student login: 24eg109a28@anurag.edu.in");
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: '24eg109a28@anurag.edu.in',
    password: 'Chatur7'
  });

  if (error) {
    console.error("❌ SIGN IN FAILED:", error.message);
  } else {
    console.log("✅ SIGN IN SUCCESSFUL!");
    console.log("Session token:", !!data.session?.access_token);
    console.log("User metadata:", data.user?.user_metadata);
  }
}

testSignIn();
