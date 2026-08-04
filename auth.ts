import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Who is allowed in. Configure via env (comma-separated emails and/or one domain):
//   ALLOWED_EMAILS="you@x.com, teammate@x.com"
//   ALLOWED_EMAIL_DOMAIN="astrotalk.com"
// If NEITHER is set, any Google account may sign in (still blocks anonymous
// traffic, but set an allowlist in production to truly lock it down).
const allowedEmails = (process.env.ALLOWED_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN || "").trim().toLowerCase().replace(/^@/, "");

function isAllowed(email: string | null | undefined): boolean {
  const e = (email || "").toLowerCase();
  if (!e) return false;
  if (allowedEmails.length) return allowedEmails.includes(e);
  if (allowedDomain) return e.endsWith("@" + allowedDomain);
  return true; // no allowlist configured → any authenticated Google account
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // trust the Railway/Vercel host header (no AUTH_URL needed)
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: { signIn: "/signin" },
  callbacks: {
    // Enforce the allowlist during the OAuth handshake.
    signIn({ profile }) {
      return isAllowed(profile?.email);
    },
    // Gate every route the middleware matches: no session → redirect to /signin.
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
});
