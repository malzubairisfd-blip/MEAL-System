import type { Metadata } from "next";
import { MealLayout } from "@/components/layout/MealLayout";
import { LanguageProvider } from "@/context/language-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "MEAL Dashboard",
  description: "Monitoring, Evaluation, Accountability, and Learning Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <MealLayout>{children}</MealLayout>
        </LanguageProvider>
      </body>
    </html>
  );
}
