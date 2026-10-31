import type { Metadata, Viewport } from "next";
import { THEME_INIT_SCRIPT } from "@/components/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hammielion — HRIS",
  description: "Kehadiran & penggajian karyawan Hammielion Petshop",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1917" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme dipasang skrip sebelum hidrasi, jadi atribut <html> memang berbeda dari render server.
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
