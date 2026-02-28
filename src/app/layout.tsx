import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@/components/SessionProvider";
import { Header } from "@/components/Header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { CookieConsent } from "@/components/CookieConsent";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://issuescout-delta.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "IssueScout - Find Your First Open Source Contribution",
    template: "%s | IssueScout",
  },
  description:
    "Discover beginner-friendly open source issues with community health scores, AI difficulty ratings, and personalized recommendations. Make your first contribution with confidence.",
  keywords: [
    "open source",
    "good first issue",
    "first contribution",
    "beginner friendly",
    "github issues",
    "open source contribution",
    "issue finder",
    "community health score",
    "AI difficulty estimation",
    "open source discovery",
    "hacktoberfest",
    "help wanted",
    "first timers only",
  ],
  authors: [{ name: "Nikoloz Turazashvili", url: "https://github.com/turazashvili" }],
  creator: "IssueScout",
  openGraph: {
    title: "IssueScout - Find Your First Open Source Contribution",
    description:
      "Discover beginner-friendly issues enriched with health scores, AI difficulty ratings, and personalized recommendations.",
    url: SITE_URL,
    siteName: "IssueScout",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "IssueScout - Find Your First Open Source Contribution",
    description:
      "Discover beginner-friendly issues enriched with health scores, AI difficulty ratings, and personalized recommendations.",
  },
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GoogleAnalytics />
        <SessionProvider>
          <TooltipProvider>
            <Header />
            <main>{children}</main>
          </TooltipProvider>
        </SessionProvider>
        <CookieConsent />
      </body>
    </html>
  );
}
