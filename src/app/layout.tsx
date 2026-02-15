import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { DashboardProvider } from "@/lib/dashboard-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Prescribed Fire Weather Dashboard",
  description:
    "Real-time weather, air quality, and fire behavior data for prescribed burn planning in Mississippi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DashboardProvider>
          <div className="flex min-h-screen bg-slate-50">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <Header />
              <main className="flex-1 p-4 lg:p-6 overflow-auto">
                {children}
              </main>
              <footer className="border-t px-4 py-2 text-center text-xs text-slate-400">
                Prescribed Fire Weather Dashboard v3.0 — Mississippi DEQ &nbsp;|&nbsp;
                For bugs or issues, contact{' '}
                <a href="mailto:RCuevas@mdeq.ms.gov" className="text-orange-600 hover:underline">
                  Rodney Cuevas — RCuevas@mdeq.ms.gov
                </a>
              </footer>
            </div>
          </div>
        </DashboardProvider>
      </body>
    </html>
  );
}
