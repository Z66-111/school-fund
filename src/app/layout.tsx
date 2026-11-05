import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { mn } from "@/lib/i18n/mn";

const plex = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${mn.brand} · ${mn.app}`, template: `%s · ${mn.brand}` },
  description: mn.login.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className={plex.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
