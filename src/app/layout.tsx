import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/providers/auth-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { UserThemeProvider } from "@/components/providers/user-theme-provider";
import VisitTracker from "@/components/VisitTracker";
import LoginModal from '@/components/LoginModal';
import RegisterModal from '@/components/RegisterModal';
import FaviconLoader from '@/components/FaviconLoader';
import GlobalPreloader from '@/components/GlobalPreloader';
import TelegramModalWrapper from '@/components/TelegramModalWrapper';
import { SITE_CONFIG } from '@/lib/site-config';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "arial"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["monospace"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0f172a',
};

export async function generateMetadata(): Promise<Metadata> {
  const siteName = SITE_CONFIG.siteName;
  const siteLogo = SITE_CONFIG.siteLogo || '/logo.webp';

  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`
    },
    description: "Puan kazan, rütbe atla, ödüller kazan!",
    keywords: [siteName.toLowerCase(), "puan", "rütbe", "ödül", "çekiliş", "etkinlik"],
    authors: [{ name: siteName }],
    creator: siteName,
    publisher: siteName,
    // ✅ FIX: Dinamik favicon - siteLogo kullanılıyor, favicon.ico istenmez
    icons: {
      icon: { url: siteLogo, type: 'image/webp' },
      apple: { url: siteLogo, type: 'image/webp' },
      shortcut: { url: siteLogo, type: 'image/webp' },
    },
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      title: siteName,
      description: "Puan kazan, rütbe atla, ödüller kazan!",
      type: "website",
      locale: "tr_TR",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        {/* Preconnect - Kritik kaynaklar için erken bağlantı */}
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />



        {/* Kritik CSS - Render blocking'i azalt */}
        <style dangerouslySetInnerHTML={{__html: `
          *{box-sizing:border-box;margin:0;padding:0}
          html,body{overflow-x:hidden;max-width:100vw}
          body{font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#fff;line-height:1.5;-webkit-font-smoothing:antialiased}
          .preloader{position:fixed;inset:0;background:linear-gradient(135deg,#020617,#0f172a,#020617);z-index:9999;display:flex;align-items:center;justify-content:center}
          img,picture,video,canvas,svg{display:block;max-width:100%;height:auto}
          header{position:fixed;top:0;left:0;right:0;z-index:50;background:rgba(15,23,42,.95);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.1);height:4rem}
          @media(min-width:1024px){header{height:5rem}}

        `}} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-screen text-white overflow-x-hidden max-w-screen`}
        suppressHydrationWarning
      >
        <GlobalPreloader />
        <QueryProvider>
          <AuthProvider>
            <UserThemeProvider>
              <FaviconLoader />
              <VisitTracker />
              {children}
              <LoginModal />
              <RegisterModal />
              <TelegramModalWrapper />
              <Toaster />
            </UserThemeProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
