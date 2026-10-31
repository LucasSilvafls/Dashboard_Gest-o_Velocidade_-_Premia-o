import type {Metadata, Viewport} from 'next';
import './globals.css'; // Global styles
import { ThemeProvider } from '@/lib/ThemeContext';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0c1017' },
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
  ],
};

export const metadata: Metadata = {
  title: 'Painel de Gestão de Velocidades - CASAGRANDE Locações & Transportes',
  description: 'Painel executivo e operacional de telemetria de frotas, auditoria de velocidades, compliance e premiação de motoristas.',
  openGraph: {
    title: 'Painel de Gestão de Velocidades - CASAGRANDE Locações & Transportes',
    description: 'Painel executivo e operacional de telemetria de frotas, auditoria de velocidades, compliance e premiação de motoristas.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Painel de Gestão de Velocidades - CASAGRANDE Locações & Transportes',
    description: 'Painel executivo e operacional de telemetria de frotas, auditoria de velocidades, compliance e premiação de motoristas.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning className="bg-[#0c1017] text-[#f1f5f9] antialiased transition-colors duration-200">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
