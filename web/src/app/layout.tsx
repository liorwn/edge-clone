import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Andale - Your page, but faster.",
  description:
    "Clone any web page into a speed-optimized static site. Pixel-perfect rendering, deferred tracking, sub-1-second loads.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
