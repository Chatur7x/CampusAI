
import os
from supabase import create_client
from dotenv import load_dotenv

# Load from ai-server/.env
dotenv_path = os.path.join("ai-server", ".env")
load_dotenv(dotenv_path)

URL = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_SERVICE_KEY")

sb = create_client(URL, KEY)

with open("tmp/diag_out.txt", "w", encoding="utf-8") as f:
    f.write("\n--- STUDENTS SCHEMA PROBE ---\n")
    try:
        res = sb.table("students").select("*").limit(1).execute()
        if res.data:
            f.write(f"Column Keys: {list(res.data[0].keys())}\n")
            f.write(f"Sample Row: {res.data[0]}\n")
        else:
            f.write("No students found.\n")
    except Exception as e:
        f.write(f"Error: {e}\n")
