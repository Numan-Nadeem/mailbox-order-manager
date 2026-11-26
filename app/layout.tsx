import type { Metadata } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import Link from "next/link";

// Every page is behind auth and reads the session cookie, so nothing here
// can be prerendered statically.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mailbox Order Manager",
  description: "Internal tool for pre-warmed Google and Microsoft mailboxes",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">Mailbox Order Manager</Link>
          <nav>
            {user ? (
              <>
                <Link href="/orders">My orders</Link>
                {user.role === "ADMIN" && <Link href="/admin">Admin</Link>}
                <span className="user-chip">
                  {user.name} ({user.role.toLowerCase()})
                </span>
                <LogoutButton />
              </>
            ) : (
              <Link href="/login">Sign in</Link>
            )}
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
