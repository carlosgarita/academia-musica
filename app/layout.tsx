import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestor Academias de Música",
  description: "Sistema de gestión para academias de música",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
