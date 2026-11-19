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

// Viewport: escalado responsivo móvil-primero. El dueño ordenó
// (2026-11-19) que NO se pueda hacer zoom en ninguna página de la
// app: maximumScale 1 + userScalable false (esto revierte la decisión
// de accesibilidad del rediseño 2026-11-17 por orden expresa suya).
// viewportFit 'cover' se conserva: activa las áreas seguras para que
// el pb-safe de la navegación funcione en teléfonos con notch, y los
// inputs ya van en 16px contra el zoom automático de iOS al enfocar.
export const viewport: Viewport = {
  themeColor: '#00357f', // Óptica Rayo brand blue
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

// Global PWA and iOS/Android device meta configurations
export const metadata: Metadata = {
  title: "Óptica Rayo - Gestión y Fidelización",
  description: "Sistema inteligente de óptica, inventario y fidelización de clientes.",
  appleWebApp: {
    capable: true,
    // 'default' (barra blanca, glifos negros), NO 'black-translucent':
    // con translucent los glifos del sistema se pintan BLANCOS sobre una
    // barra transparente y el contenido se cuela bajo el notch — sobre
    // nuestra cabecera casi blanca (#f9f9ff) y el fondo claro serían
    // ilegibles. Con 'default' la barra combina con la cabecera clara y
    // el contenido nace debajo; las áreas seguras (env()) quedan
    // aplicadas igual en barra superior e inferior por si esto cambia.
    statusBarStyle: 'default',
    title: 'Óptica Rayo',
    // Pantallas de arranque de iOS (public/splash/): el logo oficial
    // centrado sobre el fondo claro de marca. Sin estas imágenes, un
    // iPhone abre la app instalada con un flash blanco.
    startupImage: [
      { url: '/splash/apple-splash-1170x2532.png', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/apple-splash-1179x2556.png', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/apple-splash-1290x2796.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/apple-splash-1125x2436.png', media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/apple-splash-1080x2340.png', media: '(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/apple-splash-1242x2688.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/apple-splash-828x1792.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
      { url: '/splash/apple-splash-750x1334.png', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
      { url: '/splash/apple-splash-1536x2048.png', media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
      { url: '/splash/apple-splash-1668x2388.png', media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
    ],
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
        <div className={`flex-1 ${isAuthenticated ? 'pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0' : 'pb-0'}`}>
          {children}
        </div>
      </body>
    </html>
  );
}
