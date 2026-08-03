import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ad Library Dashboard",
  description: "Competitor ad scalability tracker (Meta Ad Library)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
