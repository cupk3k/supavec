import type { Database } from "@/types/supabase";
import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies(); 

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
            // Log the error for debugging? console.error("Failed to set cookie from Server Component/Handler:", error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            // Set value to empty string and maxAge to 0 to delete the cookie
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
            // Log the error for debugging? console.error("Failed to remove cookie from Server Component/Handler:", error);
          }
        },
      },
    },
  );
}
