import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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
      `${requestUrl.origin}/login`
    ); // DEBUG LINE
    return NextResponse.redirect(`${requestUrl.origin}/login`);
  }

  console.log(
    "[AUTH_CALLBACK] User found, redirecting to:",
    `${requestUrl.origin}/dashboard`
  ); // DEBUG LINE
  return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
}
