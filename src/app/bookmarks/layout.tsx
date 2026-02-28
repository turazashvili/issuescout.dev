import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saved Issues",
  description: "Your bookmarked open source issues. Track issues you want to contribute to.",
};

export default function BookmarksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
