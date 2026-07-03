import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { DesktopDock } from "@/components/layout/desktop-dock";
import { DesktopSyncButton } from "@/components/layout/desktop-sync-button";
import { MobileDock } from "@/components/layout/mobile-dock";
import { MobileSyncButton } from "@/components/layout/mobile-sync-button";
import { KeyboardNavigation } from "@/components/layout/keyboard-navigation";
import ClickSpark from "@/components/ui/click-spark";

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
          <KeyboardNavigation />
          <ClickSpark
            sparkColor="#FAFAFA"
            sparkSize={10}
            sparkRadius={15}
            sparkCount={8}
            duration={400}
          >
            <div className="flex h-full w-full overflow-hidden">
              <DesktopDock />
              <main className="flex-1 h-full overflow-auto custom-scroll relative pb-28 md:pb-32">
                {children}
              </main>
              <MobileDock />
              <MobileSyncButton />
              <DesktopSyncButton />
            </div>
          </ClickSpark>
        </Providers>
      </body>
    </html>
  );
}
