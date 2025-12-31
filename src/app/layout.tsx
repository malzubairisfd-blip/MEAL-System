import { LayoutProvider } from "@/components/layout-provider";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/context/language-context";
import { registerLicense } from '@syncfusion/ej2-base';
import "./globals.css";
import "@/styles/dashboard.css"; // Import dashboard styles
import 'leaflet/dist/leaflet.css'; // Import leaflet styles

// Register your Syncfusion license key here.
// You can obtain a free community license from https://www.syncfusion.com/products/community-license
// registerLicense('YOUR_SYNCFUSION_LICENSE_KEY');


export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentYear = new Date().getFullYear();
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <LayoutProvider year={currentYear}>{children}</LayoutProvider>
        </LanguageProvider>
        <Toaster />
      </body>
    </html>
  );
}
