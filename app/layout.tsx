import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
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

// Primary UI typeface: clean, modern geometric sans (400-800) chosen for
// the catalog redesign — friendlier at small mobile sizes than Geist.
const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Viewport setup for responsive scaling and theme color formatting
export const viewport: Viewport = {
  themeColor: '#00357f', // Óptica Rayo brand blue
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

import { createClient } from "@/utils/supabase/server";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Single light theme by design (design system v1): no theme cookie is
  // read anymore — the old dark/light switch painted the chrome almost
  // black over a light body on phones in dark mode.
  let isAuthenticated = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      isAuthenticated = true;
    }
  } catch (_) {
    // ignore
  }

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${jakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#edf1fa] text-[#111c2d]">
        <PWARegister />
        <Navbar />
        <div className={`flex-1 ${isAuthenticated ? 'pb-20 md:pb-0' : 'pb-0'}`}>
          {children}
        </div>
      </body>
    </html>
  );
}
