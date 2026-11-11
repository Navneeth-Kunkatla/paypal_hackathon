import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Header from "@/components/Header";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const grotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Countersign: PayPal agent with a mandate",
  description:
    "An AI agent that drafts, sends and chases PayPal invoices inside a mandate you set, with an audit trail of every decision. The agent acts inside your mandate. You countersign the rest.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} antialiased`}>
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
