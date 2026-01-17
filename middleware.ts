import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-url", request.url);

  try {
    // Create supabase server client
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    // Get user session - use getUser() for more reliable authentication
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    // Get session separately for compatibility
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Handle authentication
    const path = new URL(request.url).pathname;

    // Auth pages and student info page are public
    if (
      path.startsWith("/login") ||
      path.startsWith("/signup") ||
      path.startsWith("/forgot-password") ||
      path.startsWith("/reset-password") ||
      path.startsWith("/auth/callback") ||
      path === "/auth/callback" ||
      path === "/student-info"
    ) {
      // If user is already logged in, redirect to appropriate dashboard
      if (user && session) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (!profileError && profile) {
          const profileData = profile as Profile;
          switch (profileData.role) {
            case "super_admin":
              return NextResponse.redirect(
                new URL("/super-admin", request.url)
              );
            case "director":
              return NextResponse.redirect(new URL("/director", request.url));
            case "professor":
              return NextResponse.redirect(new URL("/professor", request.url));
            case "student":
              // Students don't have their own portal - redirect to info page
              return NextResponse.redirect(
                new URL("/student-info", request.url)
              );
            case "guardian":
              return NextResponse.redirect(new URL("/guardian", request.url));
          }
        }
      }
      return NextResponse.next({
        headers: requestHeaders,
      });
    }

    // Protected routes require authentication
    if (!user || !session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Get user's role
    const { data: profile, error: profileError } = (await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()) as { data: Profile | null; error: any };

    if (profileError) {
      // Log the error for debugging
      console.error("Profile error in middleware:", {
        error: profileError,
        userId: user.id,
        userEmail: user.email,
      });

      // Check if it's a PGRST error (RLS issue) or not found
      if (
        profileError.code === "PGRST116" ||
        profileError.message.includes("No rows")
      ) {
        return NextResponse.redirect(
          new URL(
            "/login?error=" +
              encodeURIComponent(
                "Tu cuenta no tiene un perfil configurado. Por favor, contacta al administrador."
              ),
            request.url
          )
        );
      }

      return NextResponse.redirect(
        new URL(
          "/login?error=" +
            encodeURIComponent(
              `Error al verificar tu perfil: ${profileError.message}. Por favor, intenta de nuevo.`
            ),
          request.url
        )
      );
    }

    if (!profile) {
      // If profile doesn't exist, redirect to login with error message
      return NextResponse.redirect(
        new URL(
          "/login?error=" +
            encodeURIComponent(
              "Tu cuenta no tiene un perfil configurado. Por favor, contacta al administrador."
            ),
          request.url
        )
      );
    }

    // Role-based routing
    const profileData = profile as Profile | null;
    if (
      path.startsWith("/super-admin") &&
      profileData?.role !== "super_admin"
    ) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (path.startsWith("/director") && profileData?.role !== "director") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (path.startsWith("/professor") && profileData?.role !== "professor") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Students don't have their own portal - they access through their guardian
    if (path.startsWith("/student") && profileData?.role === "student") {
      return NextResponse.redirect(new URL("/student-info", request.url));
    }
    if (path.startsWith("/student") && profileData?.role !== "student") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (path.startsWith("/guardian") && profileData?.role !== "guardian") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Redirect root to appropriate dashboard
    if (path === "/") {
      switch (profileData?.role) {
        case "super_admin":
          return NextResponse.redirect(new URL("/super-admin", request.url));
        case "director":
          return NextResponse.redirect(new URL("/director", request.url));
        case "professor":
          return NextResponse.redirect(new URL("/professor", request.url));
        case "student":
          // Students don't have their own portal - redirect to info page
          return NextResponse.redirect(new URL("/student-info", request.url));
        case "guardian":
          return NextResponse.redirect(new URL("/guardian", request.url));
      }
    }

    return NextResponse.next({
      headers: requestHeaders,
    });
  } catch {
    // If there's an error, force user to login
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
