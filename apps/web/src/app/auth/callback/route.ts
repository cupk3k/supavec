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
  console.log("[AUTH_CALLBACK] Calculated Origin:", requestUrl.origin); // DEBUG LINE
  const code = requestUrl.searchParams.get("code");

  const supabase = await createClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log(
      "[AUTH_CALLBACK] No user found, redirecting to:",
      `${appUrl}/login`
    ); // DEBUG LINE
    return NextResponse.redirect(`${appUrl}/login`);
  }

  console.log(
    "[AUTH_CALLBACK] User found, redirecting to:",
    `${appUrl}/dashboard`
  ); // DEBUG LINE
  return NextResponse.redirect(`${appUrl}/dashboard`);
}
