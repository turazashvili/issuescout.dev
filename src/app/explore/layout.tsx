import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: "Explore Issues",
  description:
    "Search and discover beginner-friendly open source issues filtered by language, difficulty, and community health score.",
  alternates: {
    canonical: `${siteUrl}/explore`,
  },
};

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
