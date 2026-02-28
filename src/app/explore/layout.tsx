import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Issues",
  description:
    "Search and discover beginner-friendly open source issues filtered by language, difficulty, and community health score.",
  alternates: {
    canonical: "https://issuescout-delta.vercel.app/explore",
  },
};

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
