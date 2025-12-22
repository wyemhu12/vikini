import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/features/chat", request.url));
  }

  if (pathname === "/gems") {
    const conversationId = searchParams.get("conversationId");
    const targetUrl = conversationId
      ? `/features/gems?conversationId=${conversationId}`
      : "/features/gems";
    return NextResponse.redirect(new URL(targetUrl, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/gems"],
};
