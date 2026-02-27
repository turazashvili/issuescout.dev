import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { connectToDatabase } from "./mongodb";
import { User } from "@/models/User";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
      authorization: {
        params: {
          scope: "read:user user:email",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.accessToken = account.access_token;
        token.githubId = String(profile.id);
        token.login = (profile as { login?: string }).login || "";
        token.avatarUrl =
          (profile as { avatar_url?: string }).avatar_url || "";

        // Upsert user in MongoDB
        try {
          await connectToDatabase();
          await User.findOneAndUpdate(
            { githubId: String(profile.id) },
            {
              githubId: String(profile.id),
              login: (profile as { login?: string }).login || "",
              name: profile.name || "",
              avatarUrl:
                (profile as { avatar_url?: string }).avatar_url || "",
              email: profile.email || "",
            },
            { upsert: true, returnDocument: "after" }
          );
        } catch (error) {
          console.error("Error upserting user:", error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session as { accessToken?: string }).accessToken =
          token.accessToken as string;
        (session.user as { githubId?: string }).githubId =
          token.githubId as string;
        (session.user as { login?: string }).login = token.login as string;
        (session.user as { avatarUrl?: string }).avatarUrl =
          token.avatarUrl as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});
