import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Дерево производства EVE Online',
  description: 'Интерактивный справочник производства, навыков и фитингов EVE Online.',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    shortcut: '/favicon.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
