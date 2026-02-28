import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IssueScout - Find Your First Open Source Contribution",
    short_name: "IssueScout",
    description:
      "Discover beginner-friendly open source issues with community health scores, AI difficulty ratings, and personalized recommendations.",
    start_url: "/",
    display: "standalone",
    theme_color: "#10b981",
    background_color: "#0a0a0a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
