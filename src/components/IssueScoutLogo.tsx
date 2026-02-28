"use client";

/**
 * IssueScout brand icon — the git-branch SVG used across
 * favicon, navbar, OG image, and all branding surfaces.
 *
 * Renders just the white icon strokes (no background).
 * Wrap in a gradient container for the full brand mark.
 */
export function IssueScoutIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}
