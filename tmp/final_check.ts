import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFinal() {
  const items = [
    'blockchain_hashes',
    'password_resets',
    'faculty_with_profiles',
    'students_with_profiles',
    'timetable_with_relations'
  ];

  console.log('Final verification of newly created tables and views...');
  for (const item of items) {
    const { error } = await supabase.from(item).select('*').limit(1);
    // Code PGRST204 means table exists but is empty
    if (error && error.code !== 'PGRST204' && error.code !== 'PGRST116') {
      console.log(`❌ "${item}": ${error.message} (${error.code})`);
    } else {
      console.log(`✅ "${item}": Exists and accessible`);
    }
  }
}

checkFinal();
