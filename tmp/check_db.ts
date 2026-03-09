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

async function checkAllTables() {
  console.log('Fetching all tables in public schema...');
  // We can't easily list tables via supabase-js without an RPC or raw SQL
  // But we can try to query common names or check the error messages for clues.
  
  const tablesToCheck = [
    'profiles', 'users', 'admins', 'departments', 'faculty', 'students', 
    'courses', 'classes', 'subjects', 'timetable_entries', 'attendance',
    'leave_requests', 'grades', 'notices', 'notice_reads', 'notifications',
    'conversations', 'conversation_participants', 'messages', 'audit_logs',
    'security_alerts', 'system_settings', 'blockchain_hashes', 'backups',
    'password_resets', 'token_blacklist', 'trusted_devices', 'login_history',
    'security_events', 'geo_verifications', 'mfa_backup_codes', 'api_request_log'
  ];

  for (const table of tablesToCheck) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST204' || error.code === 'PGRST116') {
        // Table exists but no records found (or single record fail)
        console.log(`✅ Table "${table}": Exists (Empty or Single Fail)`);
      } else if (error.code === 'PGRST205') {
        console.log(`❌ Table "${table}": Missing`);
      } else {
        console.log(`❓ Table "${table}": Error ${error.code} - ${error.message}`);
      }
    } else {
      console.log(`✅ Table "${table}": Exists`);
    }
  }
}

checkAllTables();
