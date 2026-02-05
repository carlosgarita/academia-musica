import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });
  response.headers.set("x-url", request.url);

  try {
    // Edge-compatible Supabase client (no cookies() from next/headers)
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: { path?: string }) {
            request.cookies.set({ name, value, ...options });
            response = NextResponse.next({ request: { headers: request.headers } });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: { path?: string }) {
            request.cookies.set({ name, value: "", ...options });
            response.cookies.set({ name, value: "", ...options });
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const path = new URL(request.url).pathname;

    // API routes: only refresh session, skip profile fetch (each API validates its own auth)
    if (path.startsWith("/api/")) {
      return response;
    }

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
      if (user) {
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
              return NextResponse.redirect(
                new URL("/student-info", request.url)
              );
            case "guardian":
              return NextResponse.redirect(new URL("/guardian", request.url));
          }
        }
      }
      return response;
    }

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { data: profile, error: profileError } = (await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()) as { data: Profile | null; error: { code?: string; message?: string } | null };

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
        (typeof profileError.message === "string" && profileError.message.includes("No rows"))
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
              `Error al verificar tu perfil: ${profileError.message ?? "Unknown"}. Por favor, intenta de nuevo.`
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

    return response;
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
