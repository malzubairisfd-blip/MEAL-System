import { LayoutProvider } from "@/components/layout-provider";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/context/language-context";
import { registerLicense } from '@syncfusion/ej2-base';
import "./globals.css";

// Register your Syncfusion license key here.
// You can obtain a free community license from https://www.syncfusion.com/products/community-license
// registerLicense('YOUR_SYNCFUSION_LICENSE_KEY');
import '@syncfusion/ej2-base/styles/material.css';
import '@syncfusion/ej2-react-charts/styles/material.css';


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
