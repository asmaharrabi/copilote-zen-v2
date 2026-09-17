import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZEN — Copilote service client',
  description: 'Centre de support omnicanal avec réponses IA sourcées',
};

const NAV = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/faq', label: 'Base de réponses' },
  { href: '/dashboard', label: 'Pilotage' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-canvas text-ink font-sans antialiased">
        <div className="flex h-screen">
          <aside className="w-56 shrink-0 bg-ink flex flex-col">
            <div className="h-14 flex items-center gap-2 px-5 border-b border-white/10">
              <span className="h-2.5 w-2.5 rounded-full bg-zen" />
              <span className="font-medium tracking-tight text-white">ZEN Support</span>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded px-3 py-2 text-sm text-white/70 hover:bg-zen/10 hover:text-zen transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="px-5 py-4 text-xs text-white/40 border-t border-white/10">
              Connecté comme Sami Ben Salah · agent
            </div>
          </aside>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}