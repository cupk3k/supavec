import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Ensure NEXT_PUBLIC_APP_URL is defined, provide a default or throw an error if critical
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
if (!appUrl) {
  console.error("FATAL ERROR: NEXT_PUBLIC_APP_URL is not defined!");
  // Optional: throw new Error("Missing NEXT_PUBLIC_APP_URL environment variable");
  // Or provide a fallback, though this is less safe for production
  // appUrl = 'http://localhost:3000'; // Example fallback
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  console.log("[AUTH_CALLBACK] Request URL:", request.url); // DEBUG LINE
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redirect to the dashboard regardless. The middleware will handle
  // protecting the dashboard page based on the session cookie
  // set by exchangeCodeForSession.
  console.log(
    "[AUTH_CALLBACK] Code exchanged (if present), redirecting to:",
    `${appUrl}/dashboard`
  ); // DEBUG LINE
  return NextResponse.redirect(`${appUrl}/dashboard`);
}
