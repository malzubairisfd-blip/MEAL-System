"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
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
  Sheet,
  ChevronDown,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

const NavLink = ({ href, icon, label, isActive, isCollapsed }: { href: string; icon: React.ReactNode; label: string; isActive: boolean, isCollapsed: boolean }) => (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted",
        isActive && "bg-primary/10 text-primary font-semibold",
        isCollapsed && "justify-center"
      )}
      title={isCollapsed ? label : undefined}
    >
      {icon}
      <span className={cn("whitespace-nowrap", isCollapsed && "hidden")}>{label}</span>
    </Link>
)

const CollapsibleNavGroup = ({
  groupName,
  groupIcon,
  links,
  pathname,
  isCollapsed,
  t
}: {
  groupName: string;
  groupIcon: React.ReactNode;
  links: { href: string; labelKey: string; icon: React.ReactNode }[];
  pathname: string;
  isCollapsed: boolean;
  t: (key: string) => string;
}) => {
  const isGroupActive = links.some(l => pathname.startsWith(l.href));
  const [isOpen, setIsOpen] = useState(isGroupActive);

  useEffect(() => {
    if (isGroupActive) {
      setIsOpen(true);
    }
  }, [isGroupActive, pathname]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted",
            isGroupActive && "text-primary",
            isCollapsed && "justify-center"
          )}
        >
          {groupIcon}
          <span className={cn("flex-1 text-left whitespace-nowrap", isCollapsed && "hidden")}>{groupName}</span>
          {!isCollapsed && <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className={cn("space-y-1 py-1", !isCollapsed && "pl-8")}>
        {links.map(link => (
            <NavLink 
                key={link.href}
                href={link.href}
                icon={link.icon}
                label={t(link.labelKey)}
                isActive={pathname.startsWith(link.href)}
                isCollapsed={isCollapsed}
            />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function LayoutProvider({ children, year }: { children: React.ReactNode, year: number }) {
  const currentPathname = usePathname();
  const [pathname, setPathname] = useState(currentPathname);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { t, isLoading: isTranslationLoading } = useTranslation();

  useEffect(() => {
    setPathname(currentPathname);
  }, [currentPathname]);
  
  const isActive = (path: string) => pathname === path || (path !== "/" && pathname.startsWith(path));
  
  const mealSystemLinks = [
    { href: "/meal-system/project", labelKey: "sidebar.projectManagement", icon: <Briefcase /> },
    { href: "/meal-system/monitoring", labelKey: "sidebar.meLifecycle", icon: <Monitor /> },
    { href: "/meal-system/project/logframe", labelKey: "sidebar.logframe", icon: <ListChecks /> },
    { href: "/meal-system/monitoring/initiation-and-planning/prepare-indicators", labelKey: "sidebar.prepareIndicators", icon: <Target /> },
    { href: "/meal-system/monitoring/initiation-and-planning/data-collection/itt", labelKey: "sidebar.indicatorTracking", icon: <Sheet /> },
  ];

  const beneficiaryAnalysisLinks = [
      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/upload", labelKey: "sidebar.upload", icon: <Upload /> },
      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/correction", labelKey: "sidebar.correction", icon: <Wrench /> },
      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/review", labelKey: "sidebar.review", icon: <Microscope /> },
      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/audit", labelKey: "sidebar.audit", icon: <ClipboardList /> },
      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/report", labelKey: "sidebar.report", icon: <BarChartHorizontal /> },
      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/export", labelKey: "sidebar.export", icon: <FileDown /> },
  ];

  let pageTitle = "Dashboard";
  const allLinks = [...mealSystemLinks, ...beneficiaryAnalysisLinks, { href: "/", labelKey: "sidebar.dashboard", icon: <Home/> }, { href: "/meal-system/settings", labelKey: "sidebar.settings", icon: <Settings/> }];
  const activeLink = allLinks.find(l => l.href !== "/" && pathname.startsWith(l.href));
  
  if (activeLink) {
    pageTitle = t(activeLink.labelKey);
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
          "bg-card text-card-foreground border-r transition-all duration-300 ease-in-out flex flex-col fixed h-full z-50",
          isCollapsed ? "w-20" : "w-64"
        )}
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
      >
        <div className="flex items-center justify-between p-4 border-b h-14">
           <div className={cn("flex items-center gap-2", isCollapsed && "hidden")}>
             <Briefcase className="size-6 text-primary" />
             <span className="text-lg font-semibold">MEAL System</span>
           </div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto">
          {isTranslationLoading ? (
            Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          ) : (
            <>
                <NavLink href="/" icon={<Home />} label={t("sidebar.dashboard")} isActive={pathname === "/"} isCollapsed={isCollapsed} />
                <CollapsibleNavGroup
                    groupName={t('sidebar.mealSystem')}
                    groupIcon={<Briefcase />}
                    links={mealSystemLinks}
                    pathname={pathname}
                    isCollapsed={isCollapsed}
                    t={t}
                />
                 <CollapsibleNavGroup
                    groupName={t('sidebar.beneficiaryAnalysis')}
                    groupIcon={<Users />}
                    links={beneficiaryAnalysisLinks}
                    pathname={pathname}
                    isCollapsed={isCollapsed}
                    t={t}
                />
                <NavLink href="/meal-system/settings" icon={<Settings />} label={t("sidebar.settings")} isActive={pathname === "/meal-system/settings"} isCollapsed={isCollapsed} />
                <NavLink href="/style-guide" icon={<Palette />} label={t("sidebar.styleGuide")} isActive={pathname === "/style-guide"} isCollapsed={isCollapsed} />
            </>
          )}
        </nav>
        <div className="mt-auto p-4 border-t">
            <div className={cn("text-xs text-muted-foreground", isCollapsed && "text-center")}>
                 © {year}
              </div>
        </div>
      </aside>

      <div className={cn("flex flex-col flex-1 transition-all duration-300 ease-in-out", isCollapsed ? "pl-20" : "pl-64")}>
        <header className="flex h-14 items-center gap-4 border-b bg-card px-6 sticky top-0 z-40">
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