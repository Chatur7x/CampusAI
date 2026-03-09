import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDept() {
  console.log('Testing department query...');
  const { data, error } = await supabase
    .from('departments')
    .select('*, students(count), faculty(count)')
    .order('name');
    
  if (error) {
    console.error('ERROR JSON:', JSON.stringify(error, null, 2));
  } else {
    console.log('SUCCESS:', data?.length, 'departments found.');
  }
}

testDept();
