
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function applyMigration() {
  const sqlPath = 'c:/Users/chatu/OneDrive/Desktop/AISMS/supabase/migrations/010_auto_profile_trigger.sql';
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Applying SQL Trigger to remote database...');
  
  // Basic split by semicolon might break functions. 
  // Let's use a more targeted split for this specific file.
  const parts = sql.split('-- Create the trigger');
  const functionPart = parts[0];
  const triggerPart = parts[1];

  try {
    console.log('Step 1: Creating Function...');
    await prisma.$executeRawUnsafe(functionPart);
    
    console.log('Step 2: Creating Trigger...');
    // Split the trigger part into drop and create
    const triggerSubParts = triggerPart.split(';');
    for (const subPart of triggerSubParts) {
      const cmd = subPart.trim();
      if (cmd && !cmd.startsWith('--')) {
        await prisma.$executeRawUnsafe(cmd);
      }
    }
    
    console.log('SQL Trigger applied successfully!');
  } catch (err) {
    console.error('Error applying SQL Trigger:', err);
    process.exit(1);
  }
}

applyMigration()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
