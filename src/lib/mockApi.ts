// Demo/mock API to keep UI functional without a backend
// Intercepts fetch calls to /api/* and serves in-memory data.

const DEMO_MODE = !import.meta.env.VITE_API_URL;

export function initMockApi() {
  if (!DEMO_MODE || typeof window === 'undefined' || (window as any).__MOCK_API_INSTALLED__) return;
  (window as any).__MOCK_API_INSTALLED__ = true;

  const originalFetch = window.fetch.bind(window);

  const departments = [
    { id: 'dept-1', name: 'Computer Science', code: 'CSE', description: 'AI & Systems' },
    { id: 'dept-2', name: 'Information Technology', code: 'IT', description: 'Networks & Cloud' },
    { id: 'dept-3', name: 'Electronics', code: 'ECE', description: 'Embedded & VLSI' },
  ];

  const courses = [
    { id: 'course-1', name: 'Algorithms', code: 'CS201', credits: 4, semester: 3, departmentId: 'dept-1', description: 'Design & Analysis' },
    { id: 'course-2', name: 'Operating Systems', code: 'CS301', credits: 4, semester: 5, departmentId: 'dept-1', description: 'Processes & Memory' },
    { id: 'course-3', name: 'Cloud Computing', code: 'IT401', credits: 3, semester: 7, departmentId: 'dept-2', description: 'Cloud native' },
  ];

  const classes = [
    { id: 'class-1', name: 'CSE', section: 'A', departmentId: 'dept-1', courseId: 'course-1', inchargeId: 'fac-1', roomNumber: 'C-201', capacity: 60, academicYear: '2024-2025' },
    { id: 'class-2', name: 'IT', section: 'A', departmentId: 'dept-2', courseId: 'course-3', inchargeId: 'fac-2', roomNumber: 'I-101', capacity: 55, academicYear: '2024-2025' },
  ];

  const facultyUsers = [
    {
      id: 'user-f1',
      faculty: {
        id: 'fac-1',
        userId: 'user-f1',
        employeeId: 'EMP001',
        designation: 'Professor',
        departmentId: 'dept-1',
        joiningDate: '2019-06-01',
        qualifications: ['PhD'],
        specialization: 'AI',
      },
    },
    {
      id: 'user-f2',
      faculty: {
        id: 'fac-2',
        userId: 'user-f2',
        employeeId: 'EMP002',
        designation: 'Associate Prof.',
        departmentId: 'dept-2',
        joiningDate: '2020-01-15',
        qualifications: ['MTech'],
        specialization: 'Cloud',
      },
    },
  ];

  const studentUsers = [
    {
      id: 'user-s1',
      student: {
        id: 'stu-1',
        userId: 'user-s1',
        enrollmentId: 'STU1001',
        departmentId: 'dept-1',
        classId: 'class-1',
        batchYear: 2024,
        semester: 5,
        faceRegistered: false,
      },
    },
    {
      id: 'user-s2',
      student: {
        id: 'stu-2',
        userId: 'user-s2',
        enrollmentId: 'STU1002',
        departmentId: 'dept-2',
        classId: 'class-2',
        batchYear: 2024,
        semester: 5,
        faceRegistered: true,
      },
    },
  ];

  let timetableEntries = [
    { id: 'tt-1', classId: 'class-1', subjectId: 'course-1', facultyId: 'fac-1', dayOfWeek: 0, startTime: '09:00', endTime: '10:00', roomNumber: 'C-201' },
    { id: 'tt-2', classId: 'class-2', subjectId: 'course-3', facultyId: 'fac-2', dayOfWeek: 1, startTime: '11:00', endTime: '12:00', roomNumber: 'I-101' },
  ];

  const analyticsPayload = {
    success: true,
    data: {
      stats: {
        totalStudents: studentUsers.length,
        totalFaculty: facultyUsers.length,
        totalDepartments: departments.length,
        todayAttendance: 92,
        recentAlerts: 1,
        pendingLeaves: 3,
      },
      monthlyTrend: [
        { month: 'Jan', percentage: 89 },
        { month: 'Feb', percentage: 91 },
        { month: 'Mar', percentage: 92 },
        { month: 'Apr', percentage: 90 },
        { month: 'May', percentage: 94 },
      ],
      departmentStats: departments.map((d, idx) => ({
        departmentId: d.id,
        departmentName: d.name,
        studentCount: 120 + idx * 10,
        attendancePercentage: 88 + idx,
      })),
    },
  };

  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function notFound() {
    return json({ success: false, message: 'Not found' }, 404);
  }

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (!url.includes('/api/')) return originalFetch(input as any, init);

    const { method = 'GET' } = init || {};
    const path = url.split('/api')[1] || '';

    // Analytics
    if (path.startsWith('/analytics/admin-dashboard') && method === 'GET') {
      return json(analyticsPayload);
    }

    // Departments
    if (path.startsWith('/admin/departments')) {
      const parts = path.split('/').filter(Boolean);
      const id = parts[2];
      if (method === 'GET') return json({ success: true, data: departments });
      if (method === 'POST') {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        const newDept = { id: `dept-${Date.now()}`, ...body };
        departments.push(newDept);
        return json({ success: true, data: newDept }, 201);
      }
      if (method === 'PUT' && id) {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        const idx = departments.findIndex((d) => d.id === id);
        if (idx >= 0) departments[idx] = { ...departments[idx], ...body };
        return json({ success: true, data: departments[idx] });
      }
      if (method === 'DELETE' && id) {
        const idx = departments.findIndex((d) => d.id === id);
        if (idx >= 0) departments.splice(idx, 1);
        return json({ success: true });
      }
      return notFound();
    }

    // Courses
    if (path.startsWith('/admin/courses')) {
      const parts = path.split('/').filter(Boolean);
      const id = parts[2];
      if (method === 'GET') return json({ success: true, data: courses });
      if (method === 'POST') {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        const newCourse = { id: `course-${Date.now()}`, ...body };
        courses.push(newCourse);
        return json({ success: true, data: newCourse }, 201);
      }
      if (method === 'PUT' && id) {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        const idx = courses.findIndex((c) => c.id === id);
        if (idx >= 0) courses[idx] = { ...courses[idx], ...body };
        return json({ success: true, data: courses[idx] });
      }
      if (method === 'DELETE' && id) {
        const idx = courses.findIndex((c) => c.id === id);
        if (idx >= 0) courses.splice(idx, 1);
        return json({ success: true });
      }
      return notFound();
    }

    // Classes
    if (path.startsWith('/admin/classes')) {
      const parts = path.split('/').filter(Boolean);
      const id = parts[2];
      if (method === 'GET') return json({ success: true, data: classes });
      if (method === 'POST') {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        const newClass = { id: `class-${Date.now()}`, ...body };
        classes.push(newClass);
        return json({ success: true, data: newClass }, 201);
      }
      if (method === 'PUT' && id) {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        const idx = classes.findIndex((c) => c.id === id);
        if (idx >= 0) classes[idx] = { ...classes[idx], ...body };
        return json({ success: true, data: classes[idx] });
      }
      if (method === 'DELETE' && id) {
        const idx = classes.findIndex((c) => c.id === id);
        if (idx >= 0) classes.splice(idx, 1);
        return json({ success: true });
      }
      return notFound();
    }

    // Users
    if (path.startsWith('/admin/users')) {
      const urlObj = new URL(url);
      const role = urlObj.searchParams.get('role');
      if (method === 'GET') {
        if (role === 'FACULTY') return json({ success: true, data: { users: facultyUsers } });
        if (role === 'STUDENT') return json({ success: true, data: { users: studentUsers } });
        return json({ success: true, data: { users: [...facultyUsers, ...studentUsers] } });
      }
      const parts = path.split('/').filter(Boolean);
      const id = parts[2];
      if (method === 'PUT' && id) {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        const target = facultyUsers.find((u) => u.id === id) || studentUsers.find((u) => u.id === id);
        if (target?.faculty) target.faculty = { ...target.faculty, ...body };
        if (target?.student) target.student = { ...target.student, ...body };
        return json({ success: true, data: target });
      }
      if (method === 'DELETE' && id) {
        const fIdx = facultyUsers.findIndex((u) => u.id === id);
        const sIdx = studentUsers.findIndex((u) => u.id === id);
        if (fIdx >= 0) facultyUsers.splice(fIdx, 1);
        if (sIdx >= 0) studentUsers.splice(sIdx, 1);
        return json({ success: true });
      }
      return notFound();
    }

    // Timetable
    if (path.startsWith('/timetable')) {
      const urlObj = new URL(url);
      const classId = urlObj.searchParams.get('classId');
      const parts = path.split('/').filter(Boolean);
      const id = parts[1]; // timetable/:id

      if (method === 'GET') {
        const filtered = classId ? timetableEntries.filter((e) => e.classId === classId) : timetableEntries;
        return json({ success: true, data: filtered });
      }
      if (method === 'POST') {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        const newEntry = { id: `tt-${Date.now()}`, ...body };
        timetableEntries.push(newEntry);
        return json({ success: true, data: newEntry }, 201);
      }
      if (method === 'PUT' && id) {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        const idx = timetableEntries.findIndex((e) => e.id === id);
        if (idx >= 0) timetableEntries[idx] = { ...timetableEntries[idx], ...body };
        return json({ success: true, data: timetableEntries[idx] });
      }
      if (method === 'DELETE' && id) {
        const idx = timetableEntries.findIndex((e) => e.id === id);
        if (idx >= 0) timetableEntries.splice(idx, 1);
        return json({ success: true });
      }
      return notFound();
    }

    // Default fallthrough
    return notFound();
  };
}
