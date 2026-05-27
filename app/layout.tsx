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
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
