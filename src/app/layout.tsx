import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Marketing Desk — Right Click",
    template: "%s — Marketing Desk",
  },
  description:
    "Right Click's marketing task board: recurring and one-off work, time logged against each task, and an automatic end-of-day summary to Teams.",
  icons: { icon: "/brand/right-click-badge-black.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d273c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
