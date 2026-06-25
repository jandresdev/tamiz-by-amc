import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tamiz | by AMC Principal",
  description: "Herramienta propietaria de diagnóstico de esquemas regulatorios en operaciones de energía",
  robots: "noindex,nofollow,noarchive,nosnippet",
  referrer: "no-referrer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <head>
        <meta name="theme-color" content="#0a0f0d" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full" style={{ background: '#0a0f0d' }}>{children}</body>
    </html>
  );
}
