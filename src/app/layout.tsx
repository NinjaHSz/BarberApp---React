import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileDock } from "@/components/layout/mobile-dock";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dashboard - BarberApp",
  description: "Sistema de gestão para barbearias premium",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BarberApp",
  },
  icons: {
    apple: "/logo.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#09090B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-surface-page flex h-screen w-full overflow-hidden`}
      >
        <Providers>
          <Sidebar />
          <main className="flex-1 h-full overflow-auto custom-scroll relative">
            {children}
          </main>
          <MobileDock />
        </Providers>
      </body>
    </html>
  );
}
