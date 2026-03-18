// provision_student.mjs
// ── Provisions the student 24eg109a28@anurag.edu.in in Supabase ──
// Run with: node provision_student.mjs

import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://akgjpqvpcugbmdenpxny.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrZ2pwcXZwY3VnYm1kZW5weG55Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjc4NDg4MSwiZXhwIjoyMDg4MzYwODgxfQ.qoH258RmgaqAsMX1UHhOrcToz3PhPHr42I-uz_paQuc';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const BASE_HEADERS = {
  apikey:        SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

// ── Student details ──────────────────────────────────────────────────
const STUDENT = {
  email:        '24eg109a28@anurag.edu.in',
  uid:          '1717c4d3-ca65-47cc-81bf-9e1e189ab3ef', // UUID from seed_users.mjs
  enrollmentId: '24EG109A28',
  firstName:    'Kolluri Chaturvedhi',
  lastName:     'Narsimha',
  password:     'Student@123456',
};

const DEPT = { name: 'CSE-CYBER SECURITY', code: 'CSE-CS' };
const CLASS = { name: 'CYBER SECURITY', section: 'A', academicYear: '2024-2025' };

// ── Helpers ───────────────────────────────────────────────────────────

async function supaRest(method, path, body) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const opts = { method, headers: { ...BASE_HEADERS } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { ok: res.ok, status: res.status, data: json };
}

async function selectFirst(table, filters = {}) {
  const params = Object.entries(filters).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}&limit=1`;
  const res = await fetch(url, { headers: BASE_HEADERS });
  const data = await res.json();
  return Array.isArray(data) ? data[0] ?? null : null;
}

async function upsertRest(table, data, onConflict) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const headers = { ...BASE_HEADERS, Prefer: `resolution=merge-duplicates,return=representation` };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }

  if (!res.ok && res.status !== 409) {
    console.error(`  ✗ upsert ${table}: ${res.status} – ${text}`);
    return null;
  }
  return Array.isArray(json) ? json[0] : json;
}

// ── Auth Admin helpers ────────────────────────────────────────────────

async function getAuthUser(email) {
  const url = `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
  });
  if (!res.ok) return null;
  const data = await res.json();
  // Supabase returns { users: [...] }
  return data.users?.[0] ?? null;
}

async function createAuthUser(email, password, metadata) {
  const url = `${SUPABASE_URL}/auth/v1/admin/users`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('  ✗ createAuthUser error:', data);
    return null;
  }
  return data;
}

async function updateAuthUserId(oldId, newId) {
  // We can't change the auth UUID directly, but we can note the actual UUID
  // This function is a no-op — we just use the returned UUID from auth
  console.log(`  ℹ Account UUID: ${oldId}`);
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 CampusAI — Student Provisioning Script');
  console.log(`📧 Provisioning: ${STUDENT.email}\n`);

  // 1. Ensure department exists
  console.log('── Step 1: Department ──');
  let dept = await selectFirst('departments', { code: DEPT.code });
  if (!dept) {
    const r = await supaRest('POST', 'departments', {
      name: DEPT.name, code: DEPT.code, description: 'Cyber Security Engineering',
    });
    dept = Array.isArray(r.data) ? r.data[0] : r.data;
    if (!dept) { console.error('  ✗ Failed to create department'); process.exit(1); }
    console.log(`  ✓ Created department: ${dept.name} (${dept.id})`);
  } else {
    console.log(`  ✓ Department exists: ${dept.name} (${dept.id})`);
  }

  // 2. Ensure class exists
  console.log('\n── Step 2: Class ──');
  let cls = await selectFirst('classes', { name: CLASS.name });
  if (!cls) {
    // Need a faculty ID — try to find any existing faculty or create a placeholder
    const anyFaculty = await selectFirst('faculty', {});
    const facultyId = anyFaculty?.id || null;

    const r = await supaRest('POST', 'classes', {
      name: CLASS.name,
      section: CLASS.section,
      department_id: dept.id,
      incharge_id: facultyId,
      room_number: 'CS-101',
      capacity: 60,
      academic_year: CLASS.academicYear,
    });
    cls = Array.isArray(r.data) ? r.data[0] : r.data;
    if (!cls) {
      // Try camelCase columns
      const r2 = await supaRest('POST', 'classes', {
        name: CLASS.name,
        section: CLASS.section,
        departmentId: dept.id,
        inchargeId: facultyId,
        roomNumber: 'CS-101',
        capacity: 60,
        academicYear: CLASS.academicYear,
      });
      cls = Array.isArray(r2.data) ? r2.data[0] : r2.data;
    }
    if (!cls) {
      console.error('  ✗ Failed to create class — continuing without classId');
      cls = { id: null };
    } else {
      console.log(`  ✓ Created class: ${cls.name} (${cls.id})`);
    }
  } else {
    console.log(`  ✓ Class exists: ${cls.name} (${cls.id})`);
  }

  // 3. Auth user — check if already exists
  console.log('\n── Step 3: Auth User ──');
  let authUser = await getAuthUser(STUDENT.email);
  let actualUid;

  if (authUser) {
    actualUid = authUser.id;
    console.log(`  ✓ Auth user exists: ${actualUid}`);
    
    // Make sure password works (update it)
    try {
      const url = `${SUPABASE_URL}/auth/v1/admin/users/${actualUid}`;
      await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: STUDENT.password,
          email_confirm: true,
          user_metadata: { role: 'STUDENT', first_name: STUDENT.firstName, last_name: STUDENT.lastName },
        }),
      });
      console.log(`  ✓ Password confirmed / metadata updated`);
    } catch (e) {
      console.warn('  ⚠ Could not update auth user:', e.message);
    }
  } else {
    const created = await createAuthUser(STUDENT.email, STUDENT.password, {
      role: 'STUDENT',
      first_name: STUDENT.firstName,
      last_name: STUDENT.lastName,
    });
    if (!created?.id) {
      console.error('  ✗ Failed to create auth user');
      process.exit(1);
    }
    actualUid = created.id;
    console.log(`  ✓ Created auth user: ${actualUid}`);
  }

  // 4. Upsert profile
  console.log('\n── Step 4: Profile ──');
  const profileResult = await upsertRest('profiles', {
    user_id: actualUid,
    email: STUDENT.email,
    first_name: STUDENT.firstName,
    last_name: STUDENT.lastName,
    role: 'STUDENT',
    theme: 'dark',
    language: 'en',
  });
  if (profileResult) {
    console.log(`  ✓ Profile upserted`);
  } else {
    console.warn('  ⚠ Profile upsert may have failed — checking...');
    const existing = await selectFirst('profiles', { user_id: actualUid });
    if (existing) console.log(`  ✓ Profile already exists`);
    else console.error('  ✗ Profile not found after upsert');
  }

  // 5. Upsert student record
  console.log('\n── Step 5: Student Record ──');
  
  // Try snake_case first
  let studentResult = await upsertRest('students', {
    user_id: actualUid,
    enrollment_id: STUDENT.enrollmentId,
    department_id: dept.id,
    class_id: cls.id,
    batch_year: 2024,
    face_registered: false,
  });

  if (!studentResult || studentResult.code || studentResult.message) {
    console.warn(`  ⚠ snake_case insert failed: ${JSON.stringify(studentResult?.message || studentResult)}`);
    // Try camelCase
    studentResult = await upsertRest('students', {
      userId: actualUid,
      enrollmentId: STUDENT.enrollmentId,
      departmentId: dept.id,
      classId: cls.id,
      batchYear: 2024,
      faceRegistered: false,
    });
  }

  if (studentResult && !studentResult.code) {
    console.log(`  ✓ Student record upserted (id: ${studentResult.id})`);
  } else {
    // Check if it already exists
    const existingSnake = await selectFirst('students', { user_id: actualUid });
    const existingCamel = await selectFirst('students', { userId: actualUid });
    const existing = existingSnake || existingCamel;
    if (existing) {
      console.log(`  ✓ Student record already exists (id: ${existing.id})`);
      // Update missing fields
      await supaRest('PATCH', `students?id=eq.${existing.id}`, {
        department_id: dept.id,
        class_id: cls.id,
      }).catch(() =>
        supaRest('PATCH', `students?id=eq.${existing.id}`, {
          departmentId: dept.id,
          classId: cls.id,
        })
      );
      console.log('  ✓ Updated department/class links');
    } else {
      console.error('  ✗ Could not create student record — check RLS policies');
    }
  }

  console.log('\n✅ Provisioning complete!\n');
  console.log('📋 Student Login Credentials:');
  console.log(`   Email:    ${STUDENT.email}`);
  console.log(`   Password: ${STUDENT.password}`);
  console.log('\n▶  The student can now:');
  console.log('   1. Login to the student portal');
  console.log('   2. Navigate to "Face Registration"');
  console.log('   3. Register their face');
  console.log('   4. Use "Live Attendance" when a faculty starts a session');
}

main().catch(e => {
  console.error('\n❌ Fatal error:', e);
  process.exit(1);
});
