
import { PrismaClient, user_role } from '@prisma/client';

const prisma = new PrismaClient();

async function reconcile() {
  const studentsToFix = [
    { email: '24eg109a28@anurag.edu.in', enrollment_id: '24eg109a28' },
    { email: '24eg109a50@anurag.edu.in', enrollment_id: '24eg109a50' }
  ];

  for (const stu of studentsToFix) {
    console.log(`\nProcessing: ${stu.email}`);
    
    // 1. Find or Create Profile
    let profile = await prisma.profile.findUnique({
      where: { email: stu.email }
    });

    if (!profile) {
      console.log(`Creating missing profile for ${stu.email}...`);
      // Warning: We don't have the auth user_id here. 
      // If the user already exists in Auth, we need their ID.
      // For now, let's look for a profile by email. 
      // If NOT found, we might need the user to log in once so our trigger works, 
      // OR we manually check the auth schema if possible.
      console.error(`Profile not found for ${stu.email}. User matching this email needs to exist in Supabase Auth.`);
      continue;
    }

    console.log(`Profile found: ${profile.id}`);

    // 2. Ensure Student record exists
    let student = await prisma.student.findUnique({
      where: { user_id: profile.user_id }
    });

    if (!student) {
      console.log(`Creating missing student record for ${profile.user_id}...`);
      
      const dept = await prisma.department.findFirst() || { id: '00000000-0000-0000-0000-000000000000' };
      const cls = await prisma.class.findFirst({ where: { department_id: dept.id } }) || { id: '00000000-0000-0000-0000-000000000000' };

      student = await prisma.student.create({
        data: {
          user_id: profile.user_id,
          enrollment_id: stu.enrollment_id,
          department_id: dept.id,
          class_id: cls.id,
          batch_year: 2024,
          semester: 1,
          is_active: true
        }
      });
      console.log(`Student record created: ${student.id}`);
    } else {
      console.log(`Student record already exists: ${student.enrollment_id}`);
      if (student.enrollment_id !== stu.enrollment_id) {
        console.log(`Updating enrollment ID to ${stu.enrollment_id}...`);
        await prisma.student.update({
          where: { id: student.id },
          data: { enrollment_id: stu.enrollment_id }
        });
      }
    }
  }
}

reconcile()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
