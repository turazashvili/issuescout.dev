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

        // Upsert user in MongoDB and check onboarding status
        try {
          await connectToDatabase();
          const user = await User.findOneAndUpdate(
            { githubId: String(profile.id) },
            {
              $setOnInsert: {
                onboardingCompleted: false,
                preferredLanguages: [],
                preferredFrameworks: [],
                languages: [],
                frameworks: [],
                topics: [],
              },
              $set: {
                githubId: String(profile.id),
                login: (profile as { login?: string }).login || "",
                name: profile.name || "",
                avatarUrl:
                  (profile as { avatar_url?: string }).avatar_url || "",
                email: profile.email || "",
              },
            },
            { upsert: true, returnDocument: "after" }
          );
          token.onboardingCompleted = user?.onboardingCompleted || false;
        } catch (error) {
          console.error("Error upserting user:", error);
          token.onboardingCompleted = false;
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
        (session.user as { onboardingCompleted?: boolean }).onboardingCompleted =
          token.onboardingCompleted as boolean;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // After sign-in, check if we should redirect to onboarding
      // Default NextAuth behavior for relative URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: "/",
  },
});
