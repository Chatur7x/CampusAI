import 'dotenv/config';

// =============================================================
// AISMS - Complete Demo User Seeder
// Creates all demo users for Google, Microsoft, Anurag, BITS Pilani
// =============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  console.log('\nRequired environment variables:');
  console.log('  SUPABASE_URL=your-supabase-url');
  console.log('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

// =============================================================
// Utility Functions
// =============================================================

async function rest(method, table, body) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const opts = { method, headers: { ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) {
    console.error(`  ✗ ${method} ${table}: ${res.status} – ${text}`);
    return null;
  }
  const data = JSON.parse(text);
  const count = Array.isArray(data) ? data.length : 1;
  console.log(`  ✓ ${method} ${table}: ${count > 0 ? count + ' row(s)' : 'ok'}`);
  return data;
}

async function selectOne(table, col, val) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${encodeURIComponent(val)}&limit=1`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  return data?.[0] ?? null;
}

async function deleteByEmail(table, email) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?email=eq.${encodeURIComponent(email)}`;
  const res = await fetch(url, { method: 'DELETE', headers });
  if (res.ok) console.log(`  ✓ Deleted ${email} from ${table}`);
  return res.ok;
}

async function authDeleteUser(uid) {
  const url = `${SUPABASE_URL}/auth/v1/admin/users/${uid}`;
  const res = await fetch(url, { method: 'DELETE', headers });
  return res.ok;
}

async function authCreateUser(email, password, metadata = {}) {
  // First try to get existing user
  const listUrl = `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`;
  const listRes = await fetch(listUrl, { headers });
  const listData = await listRes.json();
  const existingUser = listData?.users?.find((u) => u.email === email);

  if (existingUser) {
    // Update password for existing user
    const updateUrl = `${SUPABASE_URL}/auth/v1/admin/users/${existingUser.id}`;
    const updateRes = await fetch(updateUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        password,
        email_confirm: true,
        user_metadata: metadata,
      }),
    });
    if (updateRes.ok) {
      console.log(`  ✓ Updated password for: ${email}`);
      return existingUser;
    } else {
      const errData = await updateRes.json();
      console.log(`  ⚠ ${email}: ${errData.message || 'could not update'}`);
      return existingUser;
    }
  }

  // Create new user
  const url = `${SUPABASE_URL}/auth/v1/admin/users`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.log(`  ⚠ ${email}: ${data.message || 'error'}`);
    return null;
  }
  console.log(`  ✓ Created auth user: ${email}`);
  return data;
}

async function upsertProfile(userId, data) {
  const existing = await selectOne('profiles', 'user_id', userId);
  if (existing) {
    console.log(`  ⚠ Profile exists for ${data.email}`);
    return existing;
  }
  const result = await rest('POST', 'profiles', { user_id: userId, ...data });
  return result?.[0] || result;
}

async function upsertAdmin(userId, permissions = ['ALL']) {
  const existing = await selectOne('admins', 'user_id', userId);
  if (existing) {
    console.log(`  ⚠ Admin entry exists`);
    return existing;
  }
  return await rest('POST', 'admins', { user_id: userId, permissions });
}

async function upsertFaculty(userId, employeeId, designation, departmentId, specialization = '') {
  const existing = await selectOne('faculty', 'user_id', userId);
  if (existing) {
    console.log(`  ⚠ Faculty entry exists`);
    return existing;
  }
  return await rest('POST', 'faculty', {
    user_id: userId,
    employee_id: employeeId,
    designation,
    department_id: departmentId,
    joining_date: '2024-01-15',
    specialization,
  });
}

async function upsertStudent(userId, enrollmentId, departmentId, classId) {
  const existing = await selectOne('students', 'user_id', userId);
  if (existing) {
    console.log(`  ⚠ Student entry exists`);
    return existing;
  }
  return await rest('POST', 'students', {
    user_id: userId,
    enrollment_id: enrollmentId,
    department_id: departmentId,
    class_id: classId,
    batch_year: 2024,
    semester: 1,
    face_registered: false,
  });
}

async function upsertDepartment(name, code) {
  let dept = await selectOne('departments', 'code', code);
  if (dept) {
    console.log(`  ⚠ Department ${code} exists`);
    return dept;
  }
  const result = await rest('POST', 'departments', { name, code });
  return result?.[0];
}

async function upsertCourse(name, code, departmentId) {
  let course = await selectOne('courses', 'code', code);
  if (course) {
    console.log(`  ⚠ Course ${code} exists`);
    return course;
  }
  const result = await rest('POST', 'courses', {
    name, code,
    credits: 180,
    department_id: departmentId,
    semester: 1,
  });
  return result?.[0];
}

async function upsertClass(name, departmentId, courseId, inchargeId = null) {
  let cls = await selectOne('classes', 'name', name);
  if (cls) {
    console.log(`  ⚠ Class ${name} exists`);
    return cls;
  }
  const result = await rest('POST', 'classes', {
    name,
    department_id: departmentId,
    course_id: courseId,
    in_charge_id: inchargeId,
    room_number: 'Room-101',
    capacity: 60,
    academic_year: '2024-2025',
  });
  return result?.[0];
}

// =============================================================
// User Definitions
// =============================================================

const USERS = [
  // GOOGLE - Company (Glassmorphism)
  { email: 'admin@google.com', password: 'google@admin', role: 'ADMIN', firstName: 'Google', lastName: 'Admin', department: 'google_company' },
  { email: 'hr@google.com', password: 'hr@google', role: 'ADMIN', firstName: 'Google', lastName: 'HR', department: 'google_hr' },
  { email: 'it@google.com', password: 'it@google', role: 'ADMIN', firstName: 'Google', lastName: 'IT', department: 'google_it' },
  { email: 'sales@google.com', password: 'sales@google', role: 'ADMIN', firstName: 'Google', lastName: 'Sales', department: 'google_sales' },
  { email: 'marketing@google.com', password: 'marketing@google', role: 'ADMIN', firstName: 'Google', lastName: 'Marketing', department: 'google_marketing' },
  { email: 'finance@google.com', password: 'finance@google', role: 'ADMIN', firstName: 'Google', lastName: 'Finance', department: 'google_finance' },
  { email: 'manager@google.com', password: 'manager@google', role: 'ADMIN', firstName: 'Google', lastName: 'Manager', department: 'google_company' },

  // MICROSOFT - Company (Glassmorphism)
  { email: 'admin@microsoft.com', password: 'microsoft@admin', role: 'ADMIN', firstName: 'Microsoft', lastName: 'Admin', department: 'microsoft_company' },
  { email: 'hr@microsoft.com', password: 'hr@microsoft', role: 'ADMIN', firstName: 'Microsoft', lastName: 'HR', department: 'microsoft_hr' },
  { email: 'it@microsoft.com', password: 'it@microsoft', role: 'ADMIN', firstName: 'Microsoft', lastName: 'IT', department: 'microsoft_it' },
  { email: 'sales@microsoft.com', password: 'sales@microsoft', role: 'ADMIN', firstName: 'Microsoft', lastName: 'Sales', department: 'microsoft_sales' },
  { email: 'marketing@microsoft.com', password: 'marketing@microsoft', role: 'ADMIN', firstName: 'Microsoft', lastName: 'Marketing', department: 'microsoft_marketing' },
  { email: 'finance@microsoft.com', password: 'finance@microsoft', role: 'ADMIN', firstName: 'Microsoft', lastName: 'Finance', department: 'microsoft_finance' },
  { email: 'manager@microsoft.com', password: 'manager@microsoft', role: 'ADMIN', firstName: 'Microsoft', lastName: 'Manager', department: 'microsoft_company' },

  // ANURAG UNIVERSITY - Educational (Neumorphism)
  { email: 'admin@anurag.edu.in', password: 'admin@anurag', role: 'ADMIN', firstName: 'Anurag', lastName: 'Admin', department: 'anurag_company' },
  { email: 'saikrishnait@anurag.edu.in', password: 'it@saikrish', role: 'FACULTY', firstName: 'Sai', lastName: 'Krishna', department: 'anurag_faculty' },
  { email: '24eg109a28@anurag.edu.in', password: 'Chatur7', role: 'STUDENT', firstName: 'Kolluri', lastName: 'Chaturvedhi', department: 'anurag_student' },
  { email: '24eg109a50@anurag.edu.in', password: 'Divya7', role: 'STUDENT', firstName: 'Ledalla', lastName: 'Divya', department: 'anurag_student' },

  // BITS PILANI HYDERABAD - Educational (Neumorphism)
  { email: 'admin@hyderabad.bits-pilani.ac.in', password: 'admin@hydbits', role: 'ADMIN', firstName: 'BITS', lastName: 'Admin', department: 'bits_company' },
  { email: 'saikrishna.it@hyderabad.bits-pilani.ac.in', password: 'it@saikrish', role: 'FACULTY', firstName: 'Sai', lastName: 'Krishna', department: 'bits_faculty' },
  { email: 'f2024050@hyderabad.bits-pilani.ac.in', password: 'Divya7', role: 'STUDENT', firstName: 'Student', lastName: 'Divya', department: 'bits_student' },
  { email: 'f2024028@hyderabad.bits-pilani.ac.in', password: 'Chatur7', role: 'STUDENT', firstName: 'Student', lastName: 'Chatur', department: 'bits_student' },
];

// =============================================================
// Main Seeding Function
// =============================================================

async function main() {
  console.log('\n🚀 AISMS - Complete Demo User Seeder\n');
  console.log('=' .repeat(50));

  // Step 1: Clean up existing demo users
  console.log('\n📦 Step 1: Cleaning up existing users...');
  for (const user of USERS) {
    const existing = await selectOne('profiles', 'email', user.email);
    if (existing) {
      console.log(`  Found existing: ${user.email}`);
      await deleteByEmail('profiles', user.email);
      if (existing.user_id) {
        await deleteByEmail('admins', existing.user_id);
        await deleteByEmail('faculty', existing.user_id);
        await deleteByEmail('students', existing.user_id);
        await authDeleteUser(existing.user_id);
      }
    }
  }

  // Step 2: Create Departments for Companies
  console.log('\n🏢 Step 2: Creating departments...');

  // Google departments
  const googleDepts = [
    { name: 'Google - Human Resources', code: 'GGL-HR' },
    { name: 'Google - IT', code: 'GGL-IT' },
    { name: 'Google - Sales', code: 'GGL-SALES' },
    { name: 'Google - Marketing', code: 'GGL-MKT' },
    { name: 'Google - Finance', code: 'GGL-FIN' },
    { name: 'Google - Operations', code: 'GGL-OPS' },
  ];

  const microsoftDepts = [
    { name: 'Microsoft - Human Resources', code: 'MS-HR' },
    { name: 'Microsoft - IT', code: 'MS-IT' },
    { name: 'Microsoft - Sales', code: 'MS-SALES' },
    { name: 'Microsoft - Marketing', code: 'MS-MKT' },
    { name: 'Microsoft - Finance', code: 'MS-FIN' },
    { name: 'Microsoft - Operations', code: 'MS-OPS' },
  ];

  // Anurag departments
  const anuragDept = await upsertDepartment('CSE-CYBER SECURITY', 'CSE-CS');
  const anuragCourse = await upsertCourse('B.Tech Cyber Security', 'BTCS', anuragDept.id);
  const anuragClass = await upsertClass('CYBER SECURITY-A', anuragDept.id, anuragCourse.id);

  // BITS Pilani departments
  const bitsDept = await upsertDepartment('Engineering', 'BITS-ENG');
  const bitsCourse = await upsertCourse('B.E. Engineering', 'BITS-BE', bitsDept.id);
  const bitsClass = await upsertClass('BE-1', bitsDept.id, bitsCourse.id);

  for (const d of [...googleDepts, ...microsoftDepts]) {
    await upsertDepartment(d.name, d.code);
  }

  // Step 3: Create all users
  console.log('\n👤 Step 3: Creating users...');
  for (const user of USERS) {
    console.log(`\n  Creating: ${user.email}`);

    // Create auth user
    const authUser = await authCreateUser(user.email, user.password, {
      first_name: user.firstName,
      last_name: user.lastName,
      role: user.role,
    });

    if (!authUser) {
      // User might already exist, try to get their ID
      const existingProfile = await selectOne('profiles', 'email', user.email);
      if (existingProfile) {
        console.log(`  ⚠ User ${user.email} already exists with ID: ${existingProfile.user_id}`);
        
        // Create profile entry if missing
        await upsertProfile(existingProfile.user_id, {
          email: user.email,
          role: user.role,
          first_name: user.firstName,
          last_name: user.lastName,
        });

        // Create role-specific entries
        if (user.role === 'ADMIN') {
          await upsertAdmin(existingProfile.user_id);
        }
        continue;
      }
      continue;
    }

    const userId = authUser.id;

    // Create profile
    await upsertProfile(userId, {
      email: user.email,
      role: user.role,
      first_name: user.firstName,
      last_name: user.lastName,
    });

    // Create role-specific entries
    if (user.role === 'ADMIN') {
      await upsertAdmin(userId);
    } else if (user.role === 'FACULTY') {
      const employeeId = `FAC-${user.department.split('_')[0].toUpperCase()}-001`;
      await upsertFaculty(userId, employeeId, 'Faculty', anuragDept?.id || bitsDept?.id);
    } else if (user.role === 'STUDENT') {
      const enrollmentId = user.email.split('@')[0].toUpperCase();
      await upsertStudent(userId, enrollmentId, anuragDept?.id || bitsDept?.id, anuragClass?.id || bitsClass?.id);
    }

    console.log(`  ✓ ${user.email} → ${user.role}`);
  }

  // =============================================================
  // Summary
  // =============================================================
  console.log('\n' + '='.repeat(50));
  console.log('\n✅ Seeding Complete!\n');

  console.log('📋 LOGIN CREDENTIALS:\n');
  console.log('━'.repeat(50));

  console.log('\n🏢 GOOGLE (Company - Glassmorphism)');
  console.log('  Admin:   admin@google.com     / google@admin');
  console.log('  HR:      hr@google.com        / hr@google');
  console.log('  IT:      it@google.com       / it@google');
  console.log('  Sales:   sales@google.com     / sales@google');
  console.log('  Marketing: marketing@google.com / marketing@google');
  console.log('  Finance: finance@google.com   / finance@google');
  console.log('  Manager: manager@google.com  / manager@google');

  console.log('\n🏢 MICROSOFT (Company - Glassmorphism)');
  console.log('  Admin:   admin@microsoft.com      / microsoft@admin');
  console.log('  HR:      hr@microsoft.com         / hr@microsoft');
  console.log('  IT:      it@microsoft.com         / it@microsoft');
  console.log('  Sales:   sales@microsoft.com       / sales@microsoft');
  console.log('  Marketing: marketing@microsoft.com / marketing@microsoft');
  console.log('  Finance: finance@microsoft.com     / finance@microsoft');
  console.log('  Manager: manager@microsoft.com     / manager@microsoft');

  console.log('\n🎓 ANURAG UNIVERSITY (Educational - Neumorphism)');
  console.log('  Admin:   admin@anurag.edu.in       / admin@anurag');
  console.log('  Faculty:  saikrishnait@anurag.edu.in / it@saikrish');
  console.log('  Student: 24eg109a28@anurag.edu.in   / Chatur7');
  console.log('  Student: 24eg109a50@anurag.edu.in   / Divya7');

  console.log('\n🎓 BITS PILANI HYDERABAD (Educational - Neumorphism)');
  console.log('  Admin:   admin@hyderabad.bits-pilani.ac.in / admin@hydbits');
  console.log('  Faculty:  saikrishna.it@hyderabad.bits-pilani.ac.in / it@saikrish');
  console.log('  Student: f2024050@hyderabad.bits-pilani.ac.in   / Divya7');
  console.log('  Student: f2024028@hyderabad.bits-pilani.ac.in   / Chatur7');

  console.log('\n' + '━'.repeat(50));
  console.log('\n💡 Theme Detection:');
  console.log('   Company emails (.com) → Glassmorphism UI');
  console.log('   Educational emails (.edu.in, .ac.in, bits-pilani.ac.in) → Neumorphism UI\n');
}

// Run
main().catch(e => {
  console.error('\n❌ Seeding failed:', e.message);
  process.exit(1);
});
