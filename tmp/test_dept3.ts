import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDept() {
  const { data, error } = await supabase
    .from('departments')
    .select('*, students(count), faculty:faculty!faculty_department_id_fkey(count)')
    .order('name');
    
  if (error) {
    console.log('ERROR:', error);
  } else {
    console.log('SUCCESS, shape:', JSON.stringify(data?.[0], null, 2));
  }
}

testDept();
