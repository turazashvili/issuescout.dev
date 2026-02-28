import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Issue Detail",
  description: "View issue details including community health score, AI difficulty estimation, and contribution guidelines.",
};

export default function IssueDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
