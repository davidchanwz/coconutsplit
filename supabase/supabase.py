from supabase import create_client, Client
import os

SUPABASE_URL: str = os.getenv(SUPABASE_URL)
SUPABASE_KEY: str =  os.getenv(SUPABASE_KEY)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
