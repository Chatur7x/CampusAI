/**
 * CAMPUSAI - User Seed Script
 * Run: node supabase/seed_users.mjs
 * 
 * Creates the following users in Supabase Auth:
 *   Student 1: 24eg109a28@anurag.edu.in / 123456
 *   Student 2: 24eg109a50@anurag.edu.in / 123456
 *   Faculty:   saikrishnait@anurag.edu.in / 123456
 *   Admin:     admin@anurag.edu.in / admin123
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  {
    email: '24eg109a28@anurag.edu.in',
    password: '123456',
    role: 'STUDENT',
    firstName: 'Student',
    lastName: 'One',
    enrollmentId: '24EG109A28',
  },
  {
    email: '24eg109a50@anurag.edu.in',
    password: '123456',
    role: 'STUDENT',
    firstName: 'Student',
    lastName: 'Two',
    enrollmentId: '24EG109A50',
  },
  {
    email: 'saikrishnait@anurag.edu.in',
    password: '123456',
    role: 'FACULTY',
    firstName: 'Sai Krishna',
    lastName: 'IT',
    employeeId: 'FAC-SK-001',
  },
  {
    email: 'admin@anurag.edu.in',
    password: 'admin123',
    role: 'ADMIN',
    firstName: 'Admin',
    lastName: 'Anurag',
  },
];

async function seedUsers() {
  console.log('🚀 Starting user seed (admin API)...\n');

  for (const user of USERS) {
    console.log(`Creating ${user.role}: ${user.email}`);

    // Use admin API to create user (bypasses rate limits, auto-confirms email)
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        role: user.role,
        first_name: user.firstName,
        last_name: user.lastName,
      },
    });

    if (error) {
      if (error.message?.includes('already been registered') || error.message?.includes('already exists')) {
        console.log(`  ⚠️  Already exists, fetching existing user`);
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const existing = users?.find(u => u.email === user.email);
        if (existing) {
          console.log(`  ℹ️  Found existing user: ${existing.id}`);
          await ensureProfile(existing.id, user);
        }
      } else {
        console.log(`  ❌ Error: ${error.message}`);
      }
      continue;
    }

    if (!data.user) {
      console.log(`  ❌ No user returned`);
      continue;
    }

    console.log(`  ✅ Auth user created: ${data.user.id}`);
    await ensureProfile(data.user.id, user);
  }

  console.log('\n✅ Seed complete!');
  console.log('\n📋 Login credentials:');
  console.log('  Student 1: 24eg109a28@anurag.edu.in / 123456');
  console.log('  Student 2: 24eg109a50@anurag.edu.in / 123456');
  console.log('  Faculty:   saikrishnait@anurag.edu.in / 123456');
  console.log('  Admin:     admin@anurag.edu.in / admin123');
  console.log('\n⚠️  If email confirmations are enabled in Supabase,');
  console.log('   go to Dashboard → Authentication → Users and confirm them manually.');
}

async function ensureProfile(userId, user) {
  // Check if profile exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existing) {
    console.log(`  ℹ️  Profile already exists`);
    return;
  }

  // Create profile
  const { error: profileError } = await supabase.from('profiles').insert({
    user_id: userId,
    email: user.email,
    role: user.role,
    first_name: user.firstName,
    last_name: user.lastName,
    is_active: true,
    theme: 'dark',
    language: 'en',
  });

  if (profileError) {
    console.log(`  ⚠️  Profile creation: ${profileError.message}`);
  } else {
    console.log(`  ✅ Profile created`);
  }

  // Create role-specific data
  if (user.role === 'STUDENT' && user.enrollmentId) {
    // Need department and class - check if they exist
    let { data: dept } = await supabase.from('departments').select('id').eq('code', 'IT').single();
    
    if (!dept) {
      const { data: newDept } = await supabase.from('departments').insert({
        name: 'Information Technology',
        code: 'IT',
        description: 'Department of Information Technology',
        is_active: true,
      }).select('id').single();
      dept = newDept;
    }

    if (dept) {
      // Check for class
      let { data: cls } = await supabase.from('classes').select('id').eq('name', 'IT-4th Sem').single();
      
      if (cls) {
        const { error: studentError } = await supabase.from('students').insert({
          user_id: userId,
          enrollment_id: user.enrollmentId,
          department_id: dept.id,
          class_id: cls.id,
          batch_year: 2024,
          semester: 4,
          is_active: true,
        });
        
        if (studentError && !studentError.message?.includes('duplicate')) {
          console.log(`  ⚠️  Student record: ${studentError.message}`);
        } else if (!studentError) {
          console.log(`  ✅ Student record created`);
        }
      }
    }
  } else if (user.role === 'FACULTY' && user.employeeId) {
    let { data: dept } = await supabase.from('departments').select('id').eq('code', 'IT').single();
    
    if (dept) {
      const { error: facultyError } = await supabase.from('faculty').insert({
        user_id: userId,
        employee_id: user.employeeId,
        designation: 'Assistant Professor',
        department_id: dept.id,
        joining_date: '2022-06-01',
        specialization: 'Computer Science',
        is_active: true,
      });
      
      if (facultyError && !facultyError.message?.includes('duplicate')) {
        console.log(`  ⚠️  Faculty record: ${facultyError.message}`);
      } else if (!facultyError) {
        console.log(`  ✅ Faculty record created`);
      }
    }
  } else if (user.role === 'ADMIN') {
    const { error: adminError } = await supabase.from('admins').insert({
      user_id: userId,
      permissions: ['ALL'],
      department: 'IT',
    });
    
    if (adminError && !adminError.message?.includes('duplicate')) {
      console.log(`  ⚠️  Admin record: ${adminError.message}`);
    } else if (!adminError) {
      console.log(`  ✅ Admin record created`);
    }
  }
}

seedUsers().catch(console.error);
