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
  const payload = { user_id: userId, ...data };
  if (existing) {
    console.log(`  ✓ Updating existing profile for ${data.email}`);
    const url = `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    const parsed = JSON.parse(text);
    return parsed?.[0] || parsed;
  }
  const result = await rest('POST', 'profiles', payload);
  return result?.[0] || result;
}

async function upsertAdmin(userId, permissions = ['ALL']) {
  const existing = await selectOne('admins', 'user_id', userId);
  const payload = { user_id: userId, permissions };
  if (existing) {
    console.log(`  ✓ Updating existing Admin entry`);
    const url = `${SUPABASE_URL}/rest/v1/admins?user_id=eq.${userId}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    const parsed = JSON.parse(text);
    return parsed?.[0] || parsed;
  }
  return await rest('POST', 'admins', payload);
}

async function upsertFaculty(userId, employeeId, designation, departmentId, specialization = '') {
  const existing = await selectOne('faculty', 'user_id', userId);
  const payload = {
    user_id: userId,
    employee_id: employeeId,
    designation,
    department_id: departmentId,
    joining_date: '2024-01-15',
    specialization,
  };
  if (existing) {
    console.log(`  ✓ Updating existing Faculty entry`);
    const url = `${SUPABASE_URL}/rest/v1/faculty?user_id=eq.${userId}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    const parsed = JSON.parse(text);
    return parsed?.[0] || parsed;
  }
  const result = await rest('POST', 'faculty', payload);
  return result?.[0] || result;
}

async function upsertStudent(userId, enrollmentId, departmentId, classId) {
  const existing = await selectOne('students', 'user_id', userId);
  const payload = {
    user_id: userId,
    enrollment_id: enrollmentId,
    department_id: departmentId,
    class_id: classId,
    batch_year: 2024,
    semester: 1,
    face_registered: false,
  };
  if (existing) {
    console.log(`  ✓ Updating existing Student entry`);
    const url = `${SUPABASE_URL}/rest/v1/students?user_id=eq.${userId}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    const parsed = JSON.parse(text);
    return parsed?.[0] || parsed;
  }
  return await rest('POST', 'students', payload);
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

async function upsertClass(name, departmentId, courseId, inchargeId) {
  let cls = await selectOne('classes', 'name', name);
  if (cls) {
    console.log(`  ⚠ Class ${name} exists`);
    return cls;
  }
  const result = await rest('POST', 'classes', {
    name,
    section: 'A', // Required column
    department_id: departmentId,
    course_id: courseId,
    incharge_id: inchargeId, // Match exact snake_case DB column name
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
  console.log('='.repeat(50));

  // Step 1: Clean up existing classes to avoid foreign key blocks on faculty deletion
  console.log('\n🧹 Step 1: Clearing classes for clean slate...');
  const url = `${SUPABASE_URL}/rest/v1/classes`;
  await fetch(url, { method: 'DELETE', headers });

  console.log('\n📦 Step 2: Cleaning up existing users...');
  for (const user of USERS) {
    const existing = await selectOne('profiles', 'email', user.email);
    if (existing) {
      console.log(`  Found existing profile: ${user.email}`);
      await deleteByEmail('profiles', user.email);
      if (existing.user_id) {
        // Query delete specific tables using user_id column instead of email query parameter
        const delAdminUrl = `${SUPABASE_URL}/rest/v1/admins?user_id=eq.${existing.user_id}`;
        await fetch(delAdminUrl, { method: 'DELETE', headers });

        const delFacultyUrl = `${SUPABASE_URL}/rest/v1/faculty?user_id=eq.${existing.user_id}`;
        await fetch(delFacultyUrl, { method: 'DELETE', headers });

        const delStudentUrl = `${SUPABASE_URL}/rest/v1/students?user_id=eq.${existing.user_id}`;
        await fetch(delStudentUrl, { method: 'DELETE', headers });

        // Delete from auth.users via admin endpoint
        await authDeleteUser(existing.user_id);
      }
    }
  }

  // Step 3: Create Departments and Courses
  console.log('\n🏢 Step 3: Creating reference departments and courses...');

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

  const anuragDept = await upsertDepartment('CSE-CYBER SECURITY', 'CSE-CS');
  const anuragCourse = await upsertCourse('B.Tech Cyber Security', 'BTCS', anuragDept.id);

  const bitsDept = await upsertDepartment('Engineering', 'BITS-ENG');
  const bitsCourse = await upsertCourse('B.E. Engineering', 'BITS-BE', bitsDept.id);

  for (const d of [...googleDepts, ...microsoftDepts]) {
    await upsertDepartment(d.name, d.code);
  }

  // Step 4: Create Faculty first, to gather their IDs for the classes table
  console.log('\n👤 Step 4: Creating Faculty users...');
  const facultyIdMap = {};

  const facultyUsers = USERS.filter(u => u.role === 'FACULTY');
  for (const user of facultyUsers) {
    console.log(`\n  Creating Faculty: ${user.email}`);
    const deptId = user.department.startsWith('anurag') ? anuragDept.id : bitsDept.id;
    const employeeId = `FAC-${user.department.split('_')[0].toUpperCase()}-${Date.now().toString().slice(-4)}`;
    
    const authUser = await authCreateUser(user.email, user.password, {
      first_name: user.firstName,
      last_name: user.lastName,
      role: user.role,
      department_id: deptId,
      employee_id: employeeId
    });

    if (authUser) {
      const userId = authUser.id;
      await upsertProfile(userId, {
        email: user.email,
        role: user.role,
        first_name: user.firstName,
        last_name: user.lastName,
      });

      const facultyRec = await upsertFaculty(userId, employeeId, 'Faculty', deptId);
      if (facultyRec) {
        facultyIdMap[user.email] = facultyRec.id;
      }
    }
  }

  // Step 5: Create classes using the valid Faculty HOD IDs
  console.log('\n🏫 Step 5: Creating classes...');
  const anuragFacultyId = facultyIdMap['saikrishnait@anurag.edu.in'];
  const anuragClass = await upsertClass('CYBER SECURITY-A', anuragDept.id, anuragCourse.id, anuragFacultyId);

  const bitsFacultyId = facultyIdMap['saikrishna.it@hyderabad.bits-pilani.ac.in'];
  const bitsClass = await upsertClass('BE-1', bitsDept.id, bitsCourse.id, bitsFacultyId);

  // Step 6: Create remaining Admins and Students (so the triggers find active classes!)
  console.log('\n👥 Step 6: Creating Admins and Students...');
  const otherUsers = USERS.filter(u => u.role !== 'FACULTY');

  for (const user of otherUsers) {
    console.log(`\n  Creating user: ${user.email}`);
    
    let metadata = {
      first_name: user.firstName,
      last_name: user.lastName,
      role: user.role,
    };

    let deptId = null;
    let classId = null;
    let enrollmentId = null;

    if (user.role === 'STUDENT') {
      enrollmentId = user.email.split('@')[0].toUpperCase();
      deptId = user.department.startsWith('anurag') ? anuragDept.id : bitsDept.id;
      classId = user.department.startsWith('anurag') ? anuragClass.id : bitsClass.id;
      metadata.department_id = deptId;
      metadata.class_id = classId;
      metadata.enrollment_id = enrollmentId;
    }

    const authUser = await authCreateUser(user.email, user.password, metadata);

    if (authUser) {
      const userId = authUser.id;
      await upsertProfile(userId, {
        email: user.email,
        role: user.role,
        first_name: user.firstName,
        last_name: user.lastName,
      });

      if (user.role === 'ADMIN') {
        await upsertAdmin(userId);
      } else if (user.role === 'STUDENT') {
        await upsertStudent(userId, enrollmentId, deptId, classId);
      }
      console.log(`  ✓ ${user.email} → ${user.role}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('\n✅ Seeding Complete!\n');
}

// Run
main().catch(e => {
  console.error('\n❌ Seeding failed:', e.message);
  process.exit(1);
});
