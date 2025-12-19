"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { FileBarChart2, Upload, Microscope, ClipboardList, Home, Settings, FileDown, Globe, BarChartHorizontal } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useLanguage } from "@/context/language-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "./ui/button";
import { HorizontalNav } from "./HorizontalNav";

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;
  const { t, language } = useTranslation();
  const { setLanguage } = useLanguage();

  const sidebarLinks = [
    { href: "/", icon: <Home />, label: t("sidebar.dashboard") },
    { href: "/upload", icon: <Upload />, label: t("sidebar.upload") },
    { href: "/review", icon: <Microscope />, label: t("sidebar.review") },
    { href: "/audit", icon: <ClipboardList />, label: t("sidebar.audit") },
    { href: "/report", icon: <BarChartHorizontal />, label: t("sidebar.report") },
    { href: "/export", icon: <FileDown />, label: t("sidebar.export") },
    { href: "/settings", icon: <Settings />, label: t("sidebar.settings") },
  ];

  const pageTitle = sidebarLinks.find(l => l.href === pathname)?.label || t(`header.${pathname.split('/').pop() || 'dashboard'}`);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <FileBarChart2 className="size-6 text-primary" />
            <span className="text-lg font-semibold text-foreground">Beneficiary Insights</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {sidebarLinks.map(link => (
              <SidebarMenuItem key={link.href}>
                <SidebarMenuButton asChild isActive={isActive(link.href)}>
                  <Link href={link.href}>
                    {link.icon}
                    <span>{link.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="text-xs text-muted-foreground p-4">
             © {new Date().getFullYear()}
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-card px-6">
            <SidebarTrigger className="md:hidden" />
            <div className="flex-1">
                <h1 className="text-lg font-semibold capitalize">{pageTitle}</h1>
            </div>
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Globe className="h-[1.2rem] w-[1.2rem]" />
                  <span className="sr-only">Toggle language</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLanguage('en')} disabled={language === 'en'}>
                  English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('ar')} disabled={language === 'ar'}>
                  العربية
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </header>
        <HorizontalNav links={sidebarLinks} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
