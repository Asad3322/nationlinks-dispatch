import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/layout/Header';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'NationLinks Dispatch – Driver Payment Dashboard',
  description: 'Enterprise Driver Payment Management System for NationLinks Dispatch',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} NationLinks Dispatch. All rights reserved. Driver Payment Management System.
        </footer>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
