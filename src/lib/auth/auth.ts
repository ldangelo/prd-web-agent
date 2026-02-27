/**
 * NextAuth.js v5 configuration.
 *
 * Configures authentication with GitHub OAuth provider and JWT session
 * strategy. Uses PrismaAdapter for user/account persistence and maps
 * the custom User model fields (oauthId, oauthProvider, role) into
 * the JWT token and session.
 *
 * GitHub scopes requested: repo, read:user, user:email
 * The OAuth access_token is stored in the Account table by PrismaAdapter
 * and reused for GitHub API calls (repo listing, PR creation, repo cloning).
 */
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
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
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "repo read:user user:email",
        },
      },
      /**
       * Map the GitHub profile to our User model's custom fields.
       * The PrismaAdapter handles Account creation (including access_token),
       * but we need to set oauthId and oauthProvider on the User record.
       */
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
          oauthId: String(profile.id),
          oauthProvider: "github",
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
