// Quick seed script – creates faculty + student users with all required rows
const SUPABASE_URL = 'https://akgjpqvpcugbmdenpxny.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrZ2pwcXZwY3VnYm1kZW5weG55Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjc4NDg4MSwiZXhwIjoyMDg4MzYwODgxfQ.qoH258RmgaqAsMX1UHhOrcToz3PhPHr42I-uz_paQuc';

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

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
  console.log(`  ✓ ${method} ${table}: ${Array.isArray(data) ? data.length + ' rows' : 'ok'}`);
  return data;
}

async function selectOne(table, col, val) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${encodeURIComponent(val)}&limit=1`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  return data?.[0] ?? null;
}

async function main() {
  const FACULTY_UID = '3d70b8b0-81d8-4c9d-ae5e-046dd803ae62';
  const STUDENT_UID = '1717c4d3-ca65-47cc-81bf-9e1e189ab3ef';
  const DEPT_ID = '0bb89b7b-77cb-4613-9595-ec96a6b9c80a'; // already created

  // ── 0. Discover actual column names for tricky tables ──
  console.log('\n── Discovering schema ──');
  const schemaUrl = `${SUPABASE_URL}/rest/v1/`;
  const specRes = await fetch(schemaUrl, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
  const spec = await specRes.json();
  for (const tbl of ['classes', 'students', 'courses', 'faculty']) {
    const def = spec?.definitions?.[tbl];
    if (def?.properties) {
      const cols = Object.keys(def.properties);
      console.log(`  ${tbl}: ${cols.join(', ')}`);
    } else {
      console.log(`  ${tbl}: (no definition found)`);
    }
  }

  // ── 1. Check what columns courses actually has ──
  console.log('\n── Checking existing data ──');
  const existingCourse = await selectOne('courses', 'code', 'BTIT');
  const existingFaculty = await selectOne('faculty', 'userId', FACULTY_UID);
  const existingStudent = await selectOne('students', 'userId', STUDENT_UID);

  // ── 2. Create Course (without 'semester' since it might not exist) ──
  let courseId;
  if (existingCourse) {
    courseId = existingCourse.id;
    console.log(`  Course already exists: ${courseId}`);
  } else {
    // Try with just required fields
    const course = await rest('POST', 'courses', {
      name: 'B.Tech IT',
      code: 'BTIT',
      credits: 180,
      departmentId: DEPT_ID,
      description: 'Bachelor of Technology in IT',
    });
    if (course) courseId = course[0].id;
  }

  // ── 3. Create Faculty row ──
  let facultyRowId;
  if (existingFaculty) {
    facultyRowId = existingFaculty.id;
    console.log(`  Faculty row already exists: ${facultyRowId}`);
  } else {
    const faculty = await rest('POST', 'faculty', {
      userId: FACULTY_UID,
      employeeId: 'FAC-SK-001',
      designation: 'Assistant Professor',
      departmentId: DEPT_ID,
      joiningDate: '2022-06-01T00:00:00.000Z',
      specialization: 'Computer Science',
      qualifications: ['M.Tech', 'B.Tech'],
    });
    if (faculty) facultyRowId = faculty[0].id;
  }

  // ── 4. Create Class ──
  // Actual classes columns: id, name, departmentId, inchargeId, startYear, endYear, semester
  let classId;
  const existingClass = await selectOne('classes', 'name', 'IT-4th Sem');
  if (existingClass) {
    classId = existingClass.id;
    console.log(`  Class already exists: ${classId}`);
  } else if (facultyRowId) {
    const cls = await rest('POST', 'classes', {
      name: 'IT-4th Sem',
      departmentId: DEPT_ID,
      inchargeId: facultyRowId,
      startYear: 2024,
      endYear: 2025,
      semester: 4,
    });
    if (cls) classId = cls[0].id;
  }

  // ── 5. Create Student row ──
  // Actual students columns: id, userId, enrollmentId, departmentId, classId, batchYear, semester, ...
  if (existingStudent) {
    console.log(`  Student row already exists: ${existingStudent.id}`);
  } else if (classId) {
    await rest('POST', 'students', {
      userId: STUDENT_UID,
      enrollmentId: '24EG109A28',
      departmentId: DEPT_ID,
      classId,
      batchYear: 2024,
      semester: 4,
      faceRegistered: false,
    });
  }

  // ── 6. Create Admins row if needed ──
  const ADMIN_UID = '89c66246-2d7a-4800-bce4-d47574787eff';
  const existingAdmin = await selectOne('admins', 'userId', ADMIN_UID);
  if (existingAdmin) {
    console.log(`  Admin row already exists: ${existingAdmin.id}`);
  } else {
    await rest('POST', 'admins', {
      userId: ADMIN_UID,
      permissions: ['ALL'],
      department: 'IT',
    });
  }

  console.log('\n✅ Seeding complete!');
  console.log('\nLogin credentials:');
  console.log('  Faculty:  saikrishnait@anurag.edu.in / Faculty@123456');
  console.log('  Student:  24eg109a28@anurag.edu.in   / Student@123456');
  console.log('  Admin:    admin@anurag.edu.in         / Admin@123456');
}

main().catch(e => { console.error(e); process.exit(1); });
