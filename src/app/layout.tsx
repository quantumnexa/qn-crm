import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

export const metadata: Metadata = {
  title: "QuantumNexa CRM",
  description: "Role-Based CRM for Admin and Sales",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <div className="brand">
            <div className="brand-badge" />
            <Link href="/">QuantumNexa CRM</Link>
          </div>
          <div className="row" style={{ maxWidth: 400 }}>
            <Link className="btn" href="/dashboard">Dashboard</Link>
            <LogoutButton />
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
