import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/navbar";
import PWARegister from "@/components/pwa-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Viewport setup for responsive scaling and theme color formatting
export const viewport: Viewport = {
  themeColor: '#020617', // slate-950 background matches theme
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents unintended scaling to simulate native app feel
};

// Global PWA and iOS/Android device meta configurations
export const metadata: Metadata = {
  title: "Óptica Rayo - Gestión y Fidelización",
  description: "Sistema inteligente de óptica, inventario y fidelización de clientes.",
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Óptica Rayo',
  },
};

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("bg_theme")?.value || "dark";
  const superadminSession = cookieStore.get('optica_rayo_superadmin_session')?.value

  let isAuthenticated = false;
  if (superadminSession === 'true') {
    isAuthenticated = true;
  } else {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        isAuthenticated = true;
      }
    } catch (_) {
      // ignore
    }
  }

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${theme}`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        <PWARegister />
        <Navbar />
        <div className={`flex-1 ${isAuthenticated ? 'pb-20 md:pb-0' : 'pb-0'}`}>
          {children}
        </div>
      </body>
    </html>
  );
}
