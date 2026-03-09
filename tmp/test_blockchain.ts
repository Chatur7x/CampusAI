import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBlockchain() {
  console.log('Testing attendance query...');
  const { data: recordsData, error: recordsError } = await supabase
    .from('attendance')
    .select('id, student_id, date, status, method, blockchain_hash, previous_hash, nonce, created_at', { count: 'exact' })
    .not('blockchain_hash', 'is', null)
    .order('created_at', { ascending: false })
    .limit(25);
    
  if (recordsError) {
    console.error('ATTENDANCE QUERY ERROR:', recordsError);
  } else {
    console.log('Attendance Query SUCCESS');
  }

  console.log('Testing Edge Function analytics blockchain_audit...');
  const { data: auditData, error: auditError } = await supabase.functions.invoke('analytics', {
    body: { reportType: 'blockchain_audit' },
  });

  if (auditError) {
    console.error('EDGE FUNCTION ERROR:', auditError);
  } else {
    console.log('Edge Function SUCCESS');
  }
}

testBlockchain();
