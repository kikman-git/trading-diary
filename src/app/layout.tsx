import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Journal",
  description: "Personal trading journal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="container topbar-inner">
            <Link href="/" className="brand">
              📓 Trading Journal
            </Link>
            <nav className="topnav">
              <Link href="/">Dashboard</Link>
              <Link href="/new" className="btn primary sm">
                + New Trade
              </Link>
            </nav>
          </div>
        </header>
        <main className="container main">{children}</main>
      </body>
    </html>
  );
}
