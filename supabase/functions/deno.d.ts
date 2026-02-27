// Deno runtime type declarations for Supabase Edge Functions
// These types are normally provided by the Deno runtime environment

declare namespace Deno {
  interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    has(key: string): boolean;
    toObject(): Record<string, string>;
  }
  
  const env: Env;
  
  function serve(handler: (req: Request) => Promise<Response> | Response): void;
  function serve(options: { port?: number; hostname?: string }, handler: (req: Request) => Promise<Response> | Response): void;
}

declare function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;

// ESM module declarations for Supabase Edge Functions
declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export { createClient, SupabaseClient } from '@supabase/supabase-js';
}

declare module 'https://esm.sh/*' {
  const mod: any;
  export default mod;
  export = mod;
}
