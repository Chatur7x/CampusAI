import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''; // Use ANON key to test what the frontend sees

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPermissions() {
  const items = [
    'faculty_with_profiles',
    'students_with_profiles',
    'timetable_with_relations',
    'timetable'
  ];

  console.log('Testing view visibility with ANON key...');
  for (const item of items) {
    const { error } = await supabase.from(item).select('*').limit(1);
    if (error) {
      console.log(`❌ "${item}": ${error.message} (${error.code})`);
    } else {
      console.log(`✅ "${item}": Visible to ANON`);
    }
  }
}

testPermissions();
