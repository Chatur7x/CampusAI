import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDept() {
  const { data, error } = await supabase
    .from('departments')
    .select('*, students(count), faculty(count)')
    .order('name');
    
  if (error) {
    fs.writeFileSync('tmp/dept_error_clean.json', JSON.stringify(error, null, 2), 'utf8');
    console.log('Error written to tmp/dept_error_clean.json');
  } else {
    console.log('SUCCESS:', data?.length);
  }
}

testDept();
