import type { Metadata } from "next";
import "./globals.css";
import SidebarNav from "@/components/SidebarNav";
import { WalletProvider } from "@/lib/WalletContext";
import { RealmProvider } from "@/lib/RealmContext";
import NotificationBell from "@/components/NotificationBell";

export const metadata: Metadata = {
    title: "Xiimalab — AI & Blockchain Intelligence Hub",
    description:
        "Centralize your AI and Blockchain projects. Match with hackathons and job opportunities with intelligent market analytics.",
    keywords: ["AI", "Blockchain", "Hackathon", "DoraHacks", "Data Analytics", "AURA"],
    authors: [{ name: "Xiimalab" }],
    openGraph: {
        title: "Xiimalab — AI & Blockchain Intelligence Hub",
        description: "AI-powered project hub and market intelligence platform.",
        type: "website",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" className="dark">
            <body className="bg-background text-slate-100 font-sans antialiased bg-grid">
                <WalletProvider>
                    <RealmProvider>
                        <div className="flex min-h-screen">
                            {/* Fixed Sidebar */}
                            <SidebarNav />

                            {/* Main content area — offset by sidebar width on desktop only */}
                            <main className="flex-1 ml-0 md:ml-64 min-h-screen">
                                {/* Global notification bell — top right */}
                                <div className="fixed top-4 right-4 z-40">
                                    <NotificationBell />
                                </div>
                                {children}
                            </main>
                        </div>
                    </RealmProvider>
                </WalletProvider>
            </body>
        </html>
    );
}
