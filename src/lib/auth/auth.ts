/**
 * NextAuth.js v5 configuration.
 *
 * Configures authentication with Google OAuth provider and JWT session
 * strategy. Uses PrismaAdapter for user/account persistence and maps
 * the custom User model fields (oauthId, oauthProvider, role) into
 * the JWT token and session.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/**
 * Extend the default next-auth types to include our custom fields.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      role: string;
    };
  }

  interface User {
    role?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      /**
       * Map the Google profile to our User model's custom fields.
       * The PrismaAdapter handles Account creation, but we need to
       * set oauthId and oauthProvider on the User record.
       */
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          oauthId: profile.sub,
          oauthProvider: "google",
          role: "AUTHOR",
        };
      },
    }),
  ],
  callbacks: {
    /**
     * Persist user id and role into the JWT token so they are available
     * in every request without a database lookup.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "AUTHOR";
      }
      return token;
    },
    /**
     * Expose the user id and role from the JWT token in the session
     * object available to server components and API routes.
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
