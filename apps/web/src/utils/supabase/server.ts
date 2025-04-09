import type { Database } from "@/types/supabase";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { URL } from "url";

function getCookieDomain(): string | undefined {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      console.warn("[Supabase Server Client] NEXT_PUBLIC_APP_URL not set, cannot determine cookie domain.");
      return undefined;
    }
    const hostname = new URL(appUrl).hostname;
    return hostname === 'localhost' ? undefined : hostname;
  } catch (e) {
    console.error("[Supabase Server Client] Error parsing NEXT_PUBLIC_APP_URL for cookie domain:", e);
    return undefined;
  }
}

export async function createClient() {
  const cookieStore = await cookies();
  const cookieDomain = getCookieDomain();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const newOptions: CookieOptions = { ...options };
              if (cookieDomain) {
                newOptions.domain = cookieDomain;
              }
              console.log(`[Supabase Server Client] Setting cookie: Name=${name}, Options=${JSON.stringify(newOptions)}`);
              cookieStore.set(name, value, newOptions);
            });
          } catch {
            console.warn("[Supabase Server Client] The `setAll` method was called from a Server Component. This can be ignored if you have middleware refreshing user sessions.");
          }
        },
      },
    },
  );
}
