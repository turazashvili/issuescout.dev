import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started",
  description: "Set up your IssueScout profile to get personalized open source issue recommendations.",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
