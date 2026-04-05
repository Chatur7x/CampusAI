import 'dotenv/config';

// Quick script to update passwords for existing users
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const USERS = [
  { email: 'admin@google.com', password: 'google@admin' },
  { email: 'hr@google.com', password: 'hr@google' },
  { email: 'it@google.com', password: 'it@google' },
  { email: 'sales@google.com', password: 'sales@google' },
  { email: 'marketing@google.com', password: 'marketing@google' },
  { email: 'finance@google.com', password: 'finance@google' },
  { email: 'manager@google.com', password: 'manager@google' },
  { email: 'admin@microsoft.com', password: 'microsoft@admin' },
  { email: 'hr@microsoft.com', password: 'hr@microsoft' },
  { email: 'it@microsoft.com', password: 'it@microsoft' },
  { email: 'sales@microsoft.com', password: 'sales@microsoft' },
  { email: 'marketing@microsoft.com', password: 'marketing@microsoft' },
  { email: 'finance@microsoft.com', password: 'finance@microsoft' },
  { email: 'manager@microsoft.com', password: 'manager@microsoft' },
  { email: 'admin@anurag.edu.in', password: 'admin@anurag' },
  { email: 'saikrishnait@anurag.edu.in', password: 'it@saikrish' },
  { email: '24eg109a28@anurag.edu.in', password: 'Chatur7' },
  { email: '24eg109a50@anurag.edu.in', password: 'Divya7' },
  { email: 'admin@hyderabad.bits-pilani.ac.in', password: 'admin@hydbits' },
  { email: 'saikrishna.it@hyderabad.bits-pilani.ac.in', password: 'it@saikrish' },
  { email: 'f2024050@hyderabad.bits-pilani.ac.in', password: 'Divya7' },
  { email: 'f2024028@hyderabad.bits-pilani.ac.in', password: 'Chatur7' },
];

async function updateUserPassword(email, password) {
  // First get the user by email
  const listUrl = `${SUPABASE_URL}/auth/v1/admin/users`;
  const listRes = await fetch(listUrl, { headers });
  const listData = await listRes.json();
  
  if (!listData.users) {
    console.log(`  ✗ Cannot list users: ${listData.msg || listData.error_code}`);
    return false;
  }
  
  const user = listData.users.find(u => u.email === email);
  
  if (!user) {
    // Create new user
    const createUrl = `${SUPABASE_URL}/auth/v1/admin/users`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
      }),
    });
    
    if (createRes.ok) {
      console.log(`  ✓ Created: ${email}`);
      return true;
    } else {
      const err = await createRes.json();
      console.log(`  ✗ ${email}: ${err.msg || err.message}`);
      return false;
    }
  }
  
  // Update existing user
  const updateUrl = `${SUPABASE_URL}/auth/v1/admin/users/${user.id}`;
  const updateRes = await fetch(updateUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ password }),
  });
  
  if (updateRes.ok) {
    console.log(`  ✓ Updated: ${email}`);
    return true;
  } else {
    const err = await updateRes.json();
    console.log(`  ✗ ${email}: ${err.msg || err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🔐 AISMS - Password Update Script\n');
  
  let success = 0;
  let failed = 0;
  
  for (const user of USERS) {
    const ok = await updateUserPassword(user.email, user.password);
    if (ok) success++;
    else failed++;
  }
  
  console.log(`\n✅ Done! ${success} updated, ${failed} failed\n`);
}

main().catch(console.error);
