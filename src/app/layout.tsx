import type { Metadata } from "next";
import "./globals.css";
import { mn } from "@/lib/i18n/mn";

export const metadata: Metadata = { title: mn.app };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
