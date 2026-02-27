import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@/components/SessionProvider";
import { Header } from "@/components/Header";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IssueScout - Your Gateway to Open Source",
  description:
    "Discover beginner-friendly open source issues with community health scores, AI difficulty ratings, and personalized recommendations. Make your first contribution with confidence.",
  openGraph: {
    title: "IssueScout",
    description:
      "Scout your first open source contribution with intelligent issue discovery",
    type: "website",
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
        <SessionProvider>
          <TooltipProvider>
            <Header />
            <main>{children}</main>
          </TooltipProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
