import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UTM Link Builder",
  description:
    "Generate, organize, and manage UTM-tagged URLs for your marketing campaigns.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
