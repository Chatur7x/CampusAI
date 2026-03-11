import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const url = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, serviceKey);

async function inspect() {
  const { data: students, error: err1 } = await supabase.from('students').select('*').limit(1);
  const studentKeys = err1 ? err1.message : Object.keys(students?.[0] || {});

  const { data: attendance, error: err2 } = await supabase.from('attendance').select('*').limit(1);
  const attendanceKeys = err2 ? err2.message : Object.keys(attendance?.[0] || {});

  fs.writeFileSync('tmp/db_out_utf8.txt', `Students: ${JSON.stringify(studentKeys)}\nAttendance: ${JSON.stringify(attendanceKeys)}`, 'utf-8');
}

inspect().catch(console.error);
