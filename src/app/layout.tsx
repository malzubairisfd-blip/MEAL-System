import type { Metadata } from "next";
import { MealLayout } from "@/components/layout/MealLayout";
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
        <MealLayout>{children}</MealLayout>
      </body>
    </html>
  );
}
