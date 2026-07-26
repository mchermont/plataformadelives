import type { Metadata } from "next";
import { Archivo, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const splineMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://lives.propanofilmes.com.br",
  ),
  title: "Plataforma de Lives",
  description: "Transmissões ao vivo com acesso controlado, chat e quiz",
  // O Chrome headless do Egress do LiveKit roda com locale próprio (en-US),
  // diferente do pt-BR da página — sem isso ele oferece traduzir e a barra
  // "Google Translate" fica gravada dentro do vídeo composto que vai pro ar.
  other: { google: "notranslate" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`notranslate ${archivo.variable} ${splineMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        {children}
      </body>
    </html>
  );
}
