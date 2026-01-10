import type { Metadata } from "next";
import { LayoutProvider } from "@/components/layout-provider";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/context/language-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beneficiary Insights",
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
          <LayoutProvider year={new Date().getFullYear()}>{children}</LayoutProvider>
        </LanguageProvider>
        <Toaster />
      </body>
    </html>
  );
}
