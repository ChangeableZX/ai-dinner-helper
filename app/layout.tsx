import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import ActivityTracker from '@/components/ActivityTracker';

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '饭饭 · 今晚做什么',
  description: '加班晚归也能搞定晚餐，让 AI 帮你决定今晚做什么',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FF6B47',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geist.variable} h-full`}>
      <body className="min-h-full bg-gray-200">
        {/* Centred phone-width container, desktop sees grey flanks */}
        <div className="mx-auto min-h-screen max-w-[480px] bg-[#FAF7F2] relative overflow-x-hidden">
          <ActivityTracker />
          {children}
        </div>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
