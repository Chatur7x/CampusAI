import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const url = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;
// Extract project ref from URL: https://akgjpqvpcugbmdenpxny.supabase.co
const projectRef = url.replace('https://', '').replace('.supabase.co', '');

// Use the Supabase Management API to run arbitrary SQL
async function runManagementSQL(sql: string) {
  const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  
  const resp = await fetch(mgmtUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  
  const text = await resp.text();
  return { status: resp.status, body: text };
}

// Also try the pg REST endpoint that Supabase exposes
async function runRestSQL(sql: string) {
  const pgUrl = `${url}/rest/v1/`;
  
  // Try querying information_schema directly
  const resp = await fetch(`${url}/rest/v1/`, {
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
    },
  });
  return { status: resp.status, body: await resp.text() };
}

async function main() {
  console.log('=== Checking all objects in public schema that might be broken ===');
  
  // Try to list all views via management API
  const { status, body } = await runManagementSQL(`
    SELECT 
      schemaname,
      viewname,
      definition
    FROM pg_views 
    WHERE schemaname = 'public'
    ORDER BY viewname;
  `);
  
  console.log('Management API status:', status);
  console.log('Views:', body.slice(0, 2000));
  
  // Also try triggers on auth schema
  const { status: s2, body: b2 } = await runManagementSQL(`
    SELECT trigger_name, event_manipulation, event_object_table, action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public' OR event_object_schema = 'auth'
    ORDER BY trigger_name;
  `);
  console.log('\nTriggers:', b2.slice(0, 1000));
}

main().catch(console.error);
