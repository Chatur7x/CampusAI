import 'dotenv/config';

// Quick seed script – creates faculty + student users with all required rows
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

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
  // --- Setup for Cyber Security Department and Class ---
  const CYBER_DEPT_NAME = 'CSE-CYBER SECURITY';
  const CYBER_DEPT_CODE = 'CSE-CS';
  const CYBER_CLASS_NAME = 'CYBER SECURITY';
  const CYBER_CLASS_SECTION = 'A';
  const CYBER_ACADEMIC_YEAR = '2024-2025';
  const CYBER_COURSE_CODE = 'BTCS';
  const SAIKRISHNA_UID = '3d70b8b0-81d8-4c9d-ae5e-046dd803ae62';
  const SAIKRISHNA_EMP_ID = 'FAC-CS-001';
  const STUDENTS = [
    {
      email: '24eg109a28@anurag.edu.in',
      uid: '1717c4d3-ca65-47cc-81bf-9e1e189ab3ef',
      enrollmentId: '24EG109A28',
      name: { first: 'Kolluri Chaturvedhi', last: 'Narsimha' },
    },
    {
      email: '24eg109a50@anurag.edu.in',
      uid: 'b2e7c4d3-ca65-47cc-81bf-9e1e189ab3ef',
      enrollmentId: '24EG109A50',
      name: { first: 'Ledalla Sree', last: 'Divya' },
    },
  ];

  // 1. Ensure department exists
  let cyberDept = await selectOne('departments', 'code', CYBER_DEPT_CODE);
  if (!cyberDept) {
    const dept = await rest('POST', 'departments', {
      name: CYBER_DEPT_NAME,
      code: CYBER_DEPT_CODE,
      description: 'Cyber Security Engineering',
    });
    if (dept) cyberDept = dept[0];
  }
  const DEPT_ID = cyberDept.id;

  // 2. Ensure course exists
  let cyberCourse = await selectOne('courses', 'code', CYBER_COURSE_CODE);
  if (!cyberCourse) {
    const course = await rest('POST', 'courses', {
      name: 'B.Tech Cyber Security',
      code: CYBER_COURSE_CODE,
      credits: 180,
      department_id: DEPT_ID,
      description: 'Bachelor of Technology in Cyber Security',
    });
    if (course) cyberCourse = course[0];
  }
  const COURSE_ID = cyberCourse.id;

  // 3. Ensure Saikrishna faculty exists
  let saikrishna = await selectOne('faculty', 'userId', SAIKRISHNA_UID);
  if (!saikrishna) {
    const faculty = await rest('POST', 'faculty', {
      userId: SAIKRISHNA_UID,
      employeeId: SAIKRISHNA_EMP_ID,
      designation: 'Assistant Professor',
      departmentId: DEPT_ID,
      joiningDate: '2022-06-01T00:00:00.000Z',
      specialization: 'Cyber Security',
      qualifications: ['M.Tech', 'B.Tech'],
    });
    if (faculty) saikrishna = faculty[0];
  }
  const FACULTY_ID = saikrishna.id;

  // 4. Ensure class exists and assign Saikrishna as incharge
  let cyberClass = await selectOne('classes', 'name', CYBER_CLASS_NAME);
  if (!cyberClass) {
    const cls = await rest('POST', 'classes', {
      name: CYBER_CLASS_NAME,
      section: CYBER_CLASS_SECTION,
      departmentId: DEPT_ID,
      courseId: COURSE_ID,
      inchargeId: FACULTY_ID,
      roomNumber: 'CS-101',
      capacity: 60,
      academicYear: CYBER_ACADEMIC_YEAR,
    });
    if (cls) cyberClass = cls[0];
  }
  const CLASS_ID = cyberClass.id;

  // 5. Add both students to the class
  for (const s of STUDENTS) {
    let student = await selectOne('students', 'userId', s.uid);
    if (!student) {
      await rest('POST', 'students', {
        userId: s.uid,
        enrollmentId: s.enrollmentId,
        departmentId: DEPT_ID,
        classId: CLASS_ID,
        batchYear: 2024,
        semester: 1,
        faceRegistered: false,
      });
    }
  }

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
  const existingFaculty = await selectOne('faculty', 'userId', SAIKRISHNA_UID);
  const existingStudent = await selectOne('students', 'userId', STUDENTS[0].uid);

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
      department_id: DEPT_ID,
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
      userId: STUDENTS[0].uid,
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
