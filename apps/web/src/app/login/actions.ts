"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
// import { headers } from "next/headers";

export async function googleLogin() {
  console.log("[GOOGLE_LOGIN] Action started."); // DEBUG LINE
  const supabase = await createClient();
  // const headersList = await headers();
  // const origin = headersList.get("origin");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  console.log("[GOOGLE_LOGIN] NEXT_PUBLIC_APP_URL value:", appUrl); // DEBUG LINE
  if (!appUrl) {
    console.error("Error: NEXT_PUBLIC_APP_URL is not set!");
    redirect("/error?message=Configuration%20error");
  }

  const redirectToUrl = `${appUrl}/auth/callback`;
  console.log("[GOOGLE_LOGIN] Constructed redirectTo URL:", redirectToUrl); // DEBUG LINE

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // redirectTo: `${origin}/auth/callback`,
      redirectTo: redirectToUrl,
    },
  });

  if (error) {
    redirect("/error");
  }

  revalidatePath("/", "layout");
  redirect(data.url);
}

export const signOut = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  return redirect("/login");
};
