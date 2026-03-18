import os
from supabase import create_client, Client

url = "https://akgjpqvpcugbmdenpxny.supabase.co"
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

print("--- Students list (Enrollment IDs) ---")
res = supabase.table("students").select("enrollment_id").execute()
for s in res.data:
    print(f"'{s['enrollment_id']}'")
