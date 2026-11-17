import type { Metadata } from "next";
import { Roboto, Noto_Sans_Khmer } from "next/font/google";
import "./globals.css";
import { getCurrentUserServer } from "@/lib/auth";
import AppLayout from "@/components/layout/app-layout";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

// Khmer text in reports. Bundled with the app (only downloaded by browsers when a page has Khmer
// characters) so the server-side PDF export prints Khmer without any font installed on the host.
const notoKhmer = Noto_Sans_Khmer({
  weight: ["400", "700"],
  subsets: ["khmer"],
  display: "swap",
  variable: "--font-khmer",
});

export const metadata: Metadata = {
  title: "OE Portal - Operational Excellence System",
  description: "Enterprise Operational Excellence portal for timeline planning, findings tracking, and document management.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Retrieve the current user from the JWT cookie via the backend
  const currentUser = await getCurrentUserServer();

  return (
    <html lang="en" className={`${notoKhmer.variable} h-full antialiased dark`}>
      <body className={`${roboto.className} min-h-full flex flex-col`}>
        {currentUser ? <AppLayout currentUser={currentUser}>{children}</AppLayout> : children}
      </body>
    </html>
  );
}
