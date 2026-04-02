
import type { Metadata } from "next";
import AppLayout from "@/components/layout-provider";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/context/language-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "MEAL System",
  description: "AI-powered data analysis for beneficiary information.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <LanguageProvider>
          <AppLayout year={new Date().getFullYear()}>
            {children}
          </AppLayout>
        </LanguageProvider>
        <Toaster />
      </body>
    </html>
  );
}