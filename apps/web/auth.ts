import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { readAuthEnv } from "@linku/config";

const authEnv = readAuthEnv(process.env);

export const authRuntime = {
  googleConfigured:
    authEnv.googleClientId.length > 0 && authEnv.googleClientSecret.length > 0,
  hasAuthSecret: authEnv.authSecret.length > 0,
};

const providers = authRuntime.googleConfigured
  ? [
      Google({
        clientId: authEnv.googleClientId,
        clientSecret: authEnv.googleClientSecret,
      }),
    ]
  : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  secret: authEnv.authSecret || "linku-development-auth-secret",
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      try {
        const target = new URL(url);
        return target.origin === baseUrl ? url : baseUrl;
      } catch {
        return baseUrl;
      }
    },
    jwt({ token }) {
      if (!token.id) {
        token.id = token.sub ?? token.email ?? "linku-user";
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? token.sub ?? token.email ?? "linku-user");
      }

      return session;
    },
  },
});
