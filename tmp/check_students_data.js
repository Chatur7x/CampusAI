
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkStudents() {
  const emails = ['24eg109a28@anurag.edu.in', '24eg109a50@anurag.edu.in'];
  
  for (const email of emails) {
    console.log(`\nChecking email: ${email}`);
    const profile = await prisma.profiles.findUnique({
      where: { email },
      include: {
        students: true
      }
    });
    
    if (profile) {
      console.log(`Profile found: ID ${profile.id}, Role ${profile.role}`);
      if (profile.students) {
        console.log(`Student record found: Enrollment ${profile.students.enrollment_id}`);
      } else {
        console.log(`Student record MISSING for profile ${profile.id}`);
      }
    } else {
      console.log(`Profile MISSING for email ${email}`);
    }
  }
}

checkStudents()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
