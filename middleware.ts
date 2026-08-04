export { auth as middleware } from "@/auth";

// Protect everything except the auth endpoints, the sign-in page, and static
// assets. Unauthenticated requests (pages AND /api/* data routes) are redirected
// to /signin, so nobody can hit the paid API routes without logging in.
export const config = {
  matcher: ["/((?!api/auth|signin|_next/static|_next/image|favicon.ico).*)"],
};
