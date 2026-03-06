// Shared CORS headers for Supabase Edge Functions
// Uses APP_URL env var for production, falls back to localhost for dev
const allowedOrigin = Deno.env.get('APP_URL') || 'http://localhost:5173'

export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Credentials': 'true',
}
