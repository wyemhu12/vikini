import { NextResponse } from "next/server";
import { auth } from "@/lib/features/auth/auth";

/**
 * Global middleware để áp dụng chính sách default-deny cho authentication.
 * Mọi route trong /api/* (ngoại trừ các public routes) đều yêu cầu xác thực.
 */

// Routes công khai không yêu cầu authentication
const PUBLIC_ROUTES = [
  "/auth/signin",
  "/auth/error",
  "/auth/signout",
  "/api/auth", // NextAuth handlers
];

// Các file tĩnh và paths không cần auth
const EXCLUDED_PATTERNS = ["/_next", "/favicon.ico", "/robots.txt", "/sitemap.xml"];

function isPublicRoute(pathname: string): boolean {
  // Kiểm tra exact match hoặc prefix match cho public routes
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isExcludedPath(pathname: string): boolean {
  return EXCLUDED_PATTERNS.some((pattern) => pathname.startsWith(pattern));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Bỏ qua các paths không cần auth
  if (isExcludedPath(pathname)) {
    return NextResponse.next();
  }

  // Cho phép public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Kiểm tra session - nếu không có session, redirect về signin
  if (!req.auth) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // User đã xác thực, cho phép tiếp tục
  return NextResponse.next();
});

export const config = {
  // Matcher áp dụng cho tất cả routes trừ static files
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
