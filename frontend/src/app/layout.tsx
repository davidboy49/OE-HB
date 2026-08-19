import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { getCurrentUserServer } from "@/lib/auth";
import AppLayout from "@/components/layout/app-layout";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AuditDesk - Auditing System Portal",
  description: "Enterprise Auditing portal for timeline planning, findings tracking, and document management.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Retrieve the current user from the JWT cookie via the backend
  const currentUser = await getCurrentUserServer();

  return (
    <html lang="en" className="h-full antialiased dark">
      <body className={`${roboto.className} min-h-full flex flex-col`}>
        {currentUser ? <AppLayout currentUser={currentUser}>{children}</AppLayout> : children}
      </body>
    </html>
  );
}
