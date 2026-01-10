
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
import { FileBarChart2, Upload, Microscope, ClipboardList, Home, Settings, FileDown, Globe, BarChartHorizontal, Wrench, Briefcase, ListChecks, Monitor, Target, Palette } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useLanguage } from "@/context/language-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import { Skeleton } from "./ui/skeleton";

// This wrapper component ensures the DropdownMenu only renders on the client, fixing hydration errors.
function ClientOnlyLanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null; // Don't render on the server
  }

  return (
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
  );
}


export function LayoutProvider({ children, year }: { children: React.ReactNode, year: number }) {
  const currentPathname = usePathname();
  const [pathname, setPathname] = useState(currentPathname);
  const { t, isLoading: isTranslationLoading } = useTranslation();

  // Defer reading the pathname until after hydration on the client
  useEffect(() => {
    setPathname(currentPathname);
  }, [currentPathname]);
  
  const isActive = (path: string) => pathname === path || (path !== "/" && pathname.startsWith(path));


  const sidebarLinks = [
    { href: "/", icon: <Home />, label: t("sidebar.dashboard") },
    { href: "/meal-system", icon: <Briefcase />, label: "MEAL System" },
    { href: "/logframe", icon: <ListChecks />, label: "Logical Framework" },
    { href: "/monitoring", icon: <Monitor />, label: "M&E Lifecycle" },
    { href: "/monitoring/prepare-indicators", icon: <Target />, label: "Prepare Indicators" },
    { href: "/upload", icon: <Upload />, label: t("sidebar.upload") },
    { href: "/correction", icon: <Wrench />, label: 'Correction' },
    { href: "/review", icon: <Microscope />, label: t("sidebar.review") },
    { href: "/audit", icon: <ClipboardList />, label: t("sidebar.audit") },
    { href: "/report", icon: <BarChartHorizontal />, label: t("sidebar.report") },
    { href: "/export", icon: <FileDown />, label: t("sidebar.export") },
    { href: "/settings", icon: <Settings />, label: t("sidebar.settings") },
    { href: "/style-guide", icon: <Palette />, label: "Style Guide" },
  ];

  let pageTitle = "Dashboard";
  const activeLink = sidebarLinks.find(l => isActive(l.href) && l.href !== "/");
  if (activeLink) {
    pageTitle = activeLink.label;
  } else if (pathname === "/") {
    pageTitle = t("sidebar.dashboard");
  } else {
    // Fallback for nested pages not in the main sidebar
    const pathSegments = pathname.split('/').filter(Boolean);
    pageTitle = pathSegments.length > 0 ? pathSegments.join(' ') : 'Dashboard';
  }


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
            {isTranslationLoading ? (
              <>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </>
            ) : (
               sidebarLinks.map(link => (
                <SidebarMenuItem key={link.href}>
                  <SidebarMenuButton asChild isActive={isActive(link.href)}>
                    <Link href={link.href}>
                      {link.icon}
                      <span>{link.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="text-xs text-muted-foreground p-4">
             © {year}
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-card px-6">
            <SidebarTrigger className="md:hidden" />
            <div className="flex-1">
                {isTranslationLoading ? <Skeleton className="h-6 w-32" /> : <h1 className="text-lg font-semibold capitalize">{pageTitle}</h1>}
            </div>
             <ClientOnlyLanguageSwitcher />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
