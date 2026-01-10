
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  FileBarChart2,
  Upload,
  Microscope,
  ClipboardList,
  Home,
  Settings,
  FileDown,
  Globe,
  BarChartHorizontal,
  Wrench,
  Briefcase,
  ListChecks,
  Monitor,
  Target,
  Palette,
  ChevronLeft
} from "lucide-react";
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
import { cn } from "@/lib/utils";

function ClientOnlyLanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { t, isLoading: isTranslationLoading } = useTranslation();

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
    const pathSegments = pathname.split('/').filter(Boolean);
    pageTitle = pathSegments.length > 0 ? pathSegments.join(' ') : 'Dashboard';
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "bg-card text-card-foreground border-r transition-all duration-300 ease-in-out flex flex-col",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b">
           <div className={cn("flex items-center gap-2", isCollapsed && "hidden")}>
             <FileBarChart2 className="size-6 text-primary" />
             <span className="text-lg font-semibold">Beneficiary Insights</span>
           </div>
           <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className="ml-auto">
             <ChevronLeft className={cn("transition-transform", isCollapsed && "rotate-180")} />
           </Button>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-2">
          {isTranslationLoading ? (
            Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          ) : (
            sidebarLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted",
                  isActive(link.href) && "bg-primary/10 text-primary font-semibold",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? link.label : undefined}
              >
                {link.icon}
                <span className={cn(isCollapsed && "hidden")}>{link.label}</span>
              </Link>
            ))
          )}
        </nav>
        <div className="mt-auto p-4 border-t">
            <div className={cn("text-xs text-muted-foreground", isCollapsed && "text-center")}>
                 © {year}
              </div>
        </div>
      </aside>

      <div className="flex flex-col flex-1">
        <header className="flex h-14 items-center gap-4 border-b bg-card px-6">
            <div className="flex-1">
                {isTranslationLoading ? <Skeleton className="h-6 w-32" /> : <h1 className="text-lg font-semibold capitalize">{pageTitle}</h1>}
            </div>
             <ClientOnlyLanguageSwitcher />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-background">
            {children}
        </main>
      </div>
    </div>
  );
}
