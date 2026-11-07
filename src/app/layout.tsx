import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { temaAtual } from "@/lib/tema";
import "./globals.css";

const titulo = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-titulo", weight: ["600", "700", "800"] });
const corpo = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-corpo" });

export const metadata: Metadata = {
  title: { default: "MyGrana", template: "%s · MyGrana" },
  description: "Controle financeiro pessoal: contas, cartões, investimentos e patrimônio num lugar só.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1210" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tema = await temaAtual();
  return (
    <html lang="pt-BR" className={`${titulo.variable} ${corpo.variable}`} data-tema={tema === "sistema" ? undefined : tema}>
      <body className="min-h-dvh bg-fundo font-sans text-tinta antialiased">{children}</body>
    </html>
  );
}
