import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL; // Get the correct public URL

  // Check if the essential appUrl is configured
  if (!appUrl) {
    console.error("FATAL ERROR: NEXT_PUBLIC_APP_URL is not defined!");
    // Can't redirect reliably without it
    return new Response("Internal Server Error: Application URL not configured", { status: 500 });
  }

  console.log("[AUTH_CALLBACK] Request URL:", request.url); // DEBUG LINE
  console.log("[AUTH_CALLBACK] Public App URL:", appUrl); // DEBUG LINE

  const supabase = await createClient();

  if (code) {
    try {
      await supabase.auth.exchangeCodeForSession(code);
      console.log("[AUTH_CALLBACK] Code exchange successful."); // DEBUG LINE
    } catch (error) {
      console.error("[AUTH_CALLBACK] Code exchange failed:", error);
      // Redirect to public login page with error
      return NextResponse.redirect(`${appUrl}/login?error=auth_code_exchange_failed`);
    }
  } else {
    console.log("[AUTH_CALLBACK] No code found in request."); // DEBUG LINE
  }

  // Check user *after* potential code exchange
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error("[AUTH_CALLBACK] Error fetching user after exchange:", userError);
    // Redirect to public login page with error
    return NextResponse.redirect(`${appUrl}/login?error=user_fetch_failed`);
  }

  if (!user) {
    console.log(
      `[AUTH_CALLBACK] No user found after exchange/check, redirecting to: ${appUrl}/login`
    ); // DEBUG LINE
    // Use the public appUrl for the redirect
    return NextResponse.redirect(`${appUrl}/login`);
  }

  console.log(
    `[AUTH_CALLBACK] User ${user.id} found, redirecting to: ${appUrl}/dashboard`
  ); // DEBUG LINE
  // Use the public appUrl for the redirect
  return NextResponse.redirect(`${appUrl}/dashboard`);
}
