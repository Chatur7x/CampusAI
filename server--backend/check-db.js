// node check-db.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'],
});

async function main() {
  console.log('🔍 Starting Prisma Database Diagnostics...');
  
  try {
    // Attempt a basic connection and query
    const startTime = Date.now();
    const result = await prisma.$queryRaw`SELECT 1 as result, current_database() as db_name, current_user as user_name;`;
    const latency = Date.now() - startTime;
    
    console.log(`✅ DATABASE CONNECTION SUCCESSFUL (${latency}ms)`);
    console.log(`🔗 Connected to:`, result[0].db_name, 'as', result[0].user_name);
    
    // Check if the profiles table exists and is accessible
    const userCount = await prisma.profile.count();
    console.log(`👤 Found ${userCount} registered profiles in the database.`);
    
    console.log('\n🚀 Backend is perfectly configured to talk to Supabase PostgreSQL!');
  } catch (error) {
    console.error('\n❌ DATABASE CONNECTION FAILED:');
    console.error('----------------------------------------');
    console.error(error.message);
    console.error('----------------------------------------');
    console.log('💡 TIP: Check your DATABASE_URL in server--backend/.env and ensure your IP is allowed in Supabase.');
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
