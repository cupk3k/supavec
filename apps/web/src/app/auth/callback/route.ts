import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Ensure NEXT_PUBLIC_APP_URL is defined, provide a default or throw an error if critical
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
if (!appUrl) {
  console.error("FATAL ERROR: NEXT_PUBLIC_APP_URL is not defined!");
  // Optional: throw new Error("Missing NEXT_PUBLIC_APP_URL environment variable");
  // Or provide a fallback, though this is less safe for production
  // appUrl = 'http://localhost:3000'; // Example fallback
}

export async function GET(request: NextRequest) {
  // The `/auth/callback` route is required for the server-side auth flow implemented
  // by the Auth Helpers package. It exchanges an auth code for the user's session.
  // The redirect URL specified in the Auth Helpers config cookie is required for
  // processing the request.

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard"; // Default redirect

  console.log("[AUTH_CALLBACK] Request URL:", request.url); // DEBUG LINE

  if (!appUrl) {
    console.error("FATAL ERROR: NEXT_PUBLIC_APP_URL is not defined!");
    // Handle error appropriately, maybe redirect to an error page
    return NextResponse.redirect('/error?message=Missing+App+URL+Config');
  }

  // Explicitly exchange the code using the server client
  // which uses @supabase/ssr configured with next/headers cookies()
  if (code) {
    console.log("[AUTH_CALLBACK] Code found, attempting exchange..."); // DEBUG LINE
    const supabase = await createClient();
    try {
      await supabase.auth.exchangeCodeForSession(code);
      console.log("[AUTH_CALLBACK] Code exchange successful (or threw no error)."); // DEBUG LINE
    } catch (error) {
      console.error("[AUTH_CALLBACK] Code exchange failed:", error);
      // Redirect to an error page or login page if exchange fails
      const errorRedirectUrl = new URL("/login?error=auth_code_exchange_failed", appUrl);
      return NextResponse.redirect(errorRedirectUrl.toString());
    }
  }

  // Redirect to the dashboard or the 'next' URL parameter.
  // The middleware will have processed cookies set by exchangeCodeForSession.
  const redirectUrl = new URL(next, appUrl); // Construct full URL
  console.log(
    `[AUTH_CALLBACK] Code param present? ${!!code}. Redirecting to: ${redirectUrl.toString()}`,
  );
  return NextResponse.redirect(redirectUrl.toString());
}
