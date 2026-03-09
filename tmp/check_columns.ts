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

async function checkColumns() {
  console.log('Checking columns of "attendance" table...');
  const { data, error } = await supabase.from('attendance').select('*').limit(1);
  if (error) {
    console.error(`Error querying attendance: ${error.message}`);
    return;
  }
  if (data && data.length > 0) {
    console.log('Sample record keys:', Object.keys(data[0]));
  } else {
    // Table is empty, try to get column info via RPC if available or just assume it's okay if select * worked
    console.log('Table "attendance" is empty, but query succeeded.');
  }
}

checkColumns();
