import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/features/chat";
    return NextResponse.redirect(url);
  }

  if (pathname === "/gems") {
    const url = request.nextUrl.clone();
    url.pathname = "/features/gems";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/gems"],
};
