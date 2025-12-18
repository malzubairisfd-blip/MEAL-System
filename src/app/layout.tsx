import { LayoutProvider } from "@/components/layout-provider";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/context/language-context";
import "./globals.css";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <LayoutProvider>{children}</LayoutProvider>
        </LanguageProvider>
        <Toaster />
      </body>
    </html>
  );
}
