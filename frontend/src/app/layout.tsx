import type { Metadata } from 'next';
import { Poppins, Geist, Geist_Mono, Bricolage_Grotesque } from 'next/font/google';
import './globals.css';
import QueryProvider from '@/providers/QueryProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { NotificationAlertProvider } from '@/providers/NotificationAlertProvider';
import { IOSInstallBanner } from '@/components/notifications/IOSInstallBanner';
import { Toaster } from '@/components/ui/sonner';

const poppins = Poppins({ variable: '--font-geist-sans', subsets: ['latin'], weight: ['400', '500', '600', '700'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
// Redesign fonts, used through the font-ui and font-display utilities.
const geist = Geist({ variable: '--font-geist', subsets: ['latin'] });
const bricolage = Bricolage_Grotesque({ variable: '--font-bricolage', subsets: ['latin'], axes: ['opsz'] });

export const metadata: Metadata = {
  title: 'WC Digital Worktool',
  description: 'Websitechic Digital Agency Management Platform',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${geistMono.variable} ${geist.variable} ${bricolage.variable} h-full antialiased`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full">
        <QueryProvider>
          <AuthProvider>
            <NotificationAlertProvider>
              {children}
              <IOSInstallBanner />
              <Toaster richColors position="top-right" />
            </NotificationAlertProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
