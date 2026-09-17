import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RACSEMI Assess - Technical Assessment Platform',
  description: 'Enterprise online software development evaluation and recruitment platform by RACSEMI.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
