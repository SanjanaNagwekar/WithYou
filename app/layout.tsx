import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WithYou — Voice keepsakes",
  description: "A private place to preserve familiar voices and create audio keepsakes.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
