import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const url = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;
const projectRef = url.replace('https://', '').replace('.supabase.co', '');

console.log('Project ref:', projectRef);
console.log('URL:', url);
console.log('Has service key:', !!serviceKey);

// Try to execute SQL via the Supabase REST SQL endpoint using service role
async function runSQL(sql: string) {
  const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await response.text();
  console.log('Response:', response.status, body.slice(0, 300));
  return { status: response.status, body };
}

// Try to check what schemas are broken via PostgREST
async function checkSchema() {
  // Test the anon key login to confirm schema error
  const { createClient } = await import('@supabase/supabase-js');
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, serviceKey);
  
  console.log('\n=== Testing user sign in with SERVICE ROLE client ===');
  // With service role we can admin-create a session directly
  const { data, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('❌ Admin listUsers failed:', error.message);
  } else {
    const users = data.users;
    console.log('✅ Admin access works! Found', users.length, 'users');
    console.log('Users:');
    users.forEach(u => console.log(' -', u.email, '| confirmed:', !!u.email_confirmed_at));
  }
  
  // Now try regular sign in
  console.log('\n=== Testing regular sign in ===');
  const anonClient = createClient(url, anonKey);
  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
    email: '24eg109a28@anurag.edu.in',
    password: 'Chatur7',
  });
  
  if (signInError) {
    console.error('❌ Sign in still fails:', signInError.message);
    console.log('\nThe issue is inside PostgreSQL. Need to check for broken objects...');
    
    // Check if there are broken views
    const { data: viewCheck, error: viewError } = await supabase
      .from('information_schema.views')
      .select('table_name, view_definition')
      .eq('table_schema', 'public');
    
    if (!viewError && viewCheck) {
      console.log('\nViews still in public schema:');
      viewCheck.forEach((v: any) => console.log(' -', v.table_name));
    }
  } else {
    console.log('✅ Sign in SUCCESS!', signInData.user?.email);
  }
}

checkSchema().catch(console.error);
