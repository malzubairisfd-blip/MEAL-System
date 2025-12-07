import { LayoutProvider } from "@/components/layout-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LayoutProvider>{children}</LayoutProvider>
        <Toaster />
      </body>
    </html>
  );
}
