import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Syne } from "next/font/google";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { UIProvider } from "@/context/UIContext";
import { DataProvider } from "@/context/DataContext";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Rubra Cash — Gestão Financeira Inteligente",
  description: "Controle financeiro pessoal inteligente com Inteligência Artificial",
  manifest: "/manifest.json",
  themeColor: "#080810",
  appleWebApp: {
    title: "Rubra Cash",
    statusBarStyle: "black-translucent",
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${dmSans.variable} ${jetbrainsMono.variable} ${syne.variable} h-full antialiased`}
      data-theme="dark"
    >
      <body className="min-h-full flex flex-col bg-[#0A0A0A] text-[#F0F0F0]">
        <UIProvider>
          <DataProvider>
            {children}
          </DataProvider>
        </UIProvider>
      </body>
    </html>
  );
}
