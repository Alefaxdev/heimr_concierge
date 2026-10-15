import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: "HEIMR Concierge",
  description: "HEIMR Concierge",
};

export const viewport: Viewport = {
  themeColor: "#0C1F0F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
