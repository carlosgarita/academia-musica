import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const type = requestUrl.searchParams.get("type");
    const error = requestUrl.searchParams.get("error");
    const errorDescription = requestUrl.searchParams.get("error_description");
    const next = requestUrl.searchParams.get("next") || "/";

    // Handle errors in query params (e.g., expired OTP)
    if (error && type === "recovery") {
      const errorMessage = errorDescription || error;
      return NextResponse.redirect(
        new URL(
          `/reset-password?error=${encodeURIComponent(errorMessage)}`,
          requestUrl.origin
        )
      );
    }

    if (code) {
      const cookieStore = cookies();
      const supabase = await createServerClient(cookieStore);

      if (type === "recovery") {
        // For password reset, redirect to reset-password with the code
        // The client will handle it from the URL hash
        // We can't use exchangeCodeForSession here because it requires PKCE
        // which isn't used in password recovery flow
        return NextResponse.redirect(
          new URL(`/reset-password?code=${code}`, requestUrl.origin)
        );
      } else {
        // For regular authentication, use exchangeCodeForSession
        await supabase.auth.exchangeCodeForSession(code);
      }
    }

    // If no code but type is recovery, redirect to reset-password anyway
    // (in case Supabase sends the token in hash instead)
    if (type === "recovery") {
      return NextResponse.redirect(
        new URL("/reset-password", requestUrl.origin)
      );
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  } catch (err) {
    // If there's any error, redirect to reset-password with error message
    const requestUrl = new URL(request.url);
    const errorMessage =
      err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.redirect(
      new URL(
        `/reset-password?error=${encodeURIComponent(errorMessage)}`,
        requestUrl.origin
      )
    );
  }
}
