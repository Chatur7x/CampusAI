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

async function checkViews() {
  const views = [
    'faculty_with_profiles',
    'students_with_profiles',
    'timetable_with_relations',
    'timetable'
  ];

  console.log('Checking database views in Supabase...');
  for (const view of views) {
    const { error } = await supabase.from(view).select('*').limit(1);
    if (error) {
      console.log(`❌ View "${view}": ${error.message} (${error.code})`);
    } else {
      console.log(`✅ View "${view}": Exists`);
    }
  }
}

checkViews();
