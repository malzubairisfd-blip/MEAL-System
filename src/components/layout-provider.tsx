

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
  Users,
  FileEdit,
  BrainCircuit,
  LayoutDashboard,
  Eye,
  Plus,
  CalendarCheck,
  Edit,
  PlayCircle,
  Flag,
  BarChart,
  Activity,
  ShieldCheck,
  DollarSign,
  Building,
  Table,
  Calculator,
  UserSearch,
  MessageSquare,
  ClipboardPenLine,
  Network,
  Layers,
  Link2,
  User,
  HeartPulse,
  Stethoscope,
  ScanSearch,
  Send,
  UserCheck,
  ThumbsUp,
  Hand,
  Wallet,
  CreditCard,
  BarChart2,
  Menu,
  PanelLeft,
  PanelRight,
  Baby,
  Database,

  // ✅ FIXED MISSING ICONS
  PieChart,
  ClipboardCheck,
  ShieldAlert,
  FileText,
  MessageSquareWarning,
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
);

const navItems = [
    { href: "/", label: "Dashboard", icon: <Home /> },
    {
        href: "/meal-system", label: "MEAL System", icon: <Briefcase />,
        subItems: [
            {
                href: "/meal-system/project", label: "Project", icon: <Briefcase />, subItems: [
                    { href: "/meal-system/project/dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
                    { href: "/meal-system/project/details", label: "Details", icon: <Eye /> },
                    { href: "/meal-system/project/add", label: "Add Project", icon: <Plus /> },
                    { href: "/meal-system/project/plan", label: "Plan", icon: <CalendarCheck />, subItems: [
                        { href: "/meal-system/project/plan/add-task", label: "Add Task", icon: <Plus /> },
                        { href: "/meal-system/project/plan/edit-task", label: "Edit Task", icon: <Edit /> },
                    ]},
                    { href: "/meal-system/project/logframe", label: "Logframe", icon: <ListChecks />, subItems: [
                        { href: "/meal-system/project/logframe/add", label: "Add", icon: <Plus /> },
                        { href: "/meal-system/project/logframe/edit", label: "Edit", icon: <Edit /> },
                    ]},
                ]
            },
            {
                href: "/meal-system/monitoring", label: "Monitoring", icon: <Monitor />,
                subItems: [
                    { href: "/meal-system/monitoring/initiation-and-planning", label: "Initiation & Planning", icon: <ClipboardList />, subItems: [
                        { href: "/meal-system/monitoring/initiation-and-planning/purpose-and-scope", label: "Purpose & Scope", icon: <Target />, subItems: [
                           { href: "/meal-system/monitoring/initiation-and-planning/purpose-and-scope/add", label: "Add", icon: <Plus /> },
                        ]},
                        { href: "/meal-system/monitoring/initiation-and-planning/data-collection", label: "Data Collection", icon: <Database />, subItems: [
                           { href: "/meal-system/monitoring/initiation-and-planning/data-collection/itt", label: "ITT", icon: <Sheet />, subItems: [
                             { href: "/meal-system/monitoring/initiation-and-planning/data-collection/itt/edit", label: "Edit", icon: <Edit /> },
                           ] },
                        ]},
                        { href: "/meal-system/monitoring/initiation-and-planning/data-analysis", label: "Data Analysis", icon: <PieChart /> },
                        { href: "/meal-system/monitoring/initiation-and-planning/reporting", label: "Reporting", icon: <FileText /> },
                        { href: "/meal-system/monitoring/initiation-and-planning/hr", label: "HR", icon: <Users /> },
                        { href: "/meal-system/monitoring/initiation-and-planning/budget", label: "Budget", icon: <DollarSign /> },
                        { href: "/meal-system/monitoring/initiation-and-planning/me-plan-table", label: "ME Plan Table", icon: <Table />, subItems: [
                             { href: "/meal-system/monitoring/initiation-and-planning/me-plan-table/add", label: "Add", icon: <Plus /> },
                        ]},
                        { href: "/meal-system/monitoring/initiation-and-planning/prepare-indicators", label: "Prepare Indicators", icon: <Target />, subItems: [
                             { href: "/meal-system/monitoring/initiation-and-planning/prepare-indicators/add", label: "Add", icon: <Plus /> },
                        ]},
                        { href: "/meal-system/monitoring/initiation-and-planning/sampling-calculator", label: "Sampling Calculator", icon: <Calculator /> },
                    ]},
                    {
                        href: "/meal-system/monitoring/implementation", label: "Implementation", icon: <PlayCircle />,
                        subItems: [
                            {
                                href: "/meal-system/monitoring/implementation/beneficiary-monitoring", label: "Beneficiary Monitoring", icon: <Users />, subItems: [
                                    { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries", label: "Beneficiaries", icon: <Users />, subItems: [
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/upload", label: "Upload", icon: <Upload /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/correction", label: "Correction", icon: <Wrench /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/review", label: "Review", icon: <Microscope /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/audit", label: "Audit", icon: <ClipboardList /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/report", label: "Report", icon: <BarChartHorizontal /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/export", label: "Export", icon: <FileDown /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/database", label: "Database", icon: <Database /> },
                                    ]},
                                    { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators", label: "Community Educators", icon: <UserCheck />, subItems: [
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/selection", label: "Selection", icon: <UserSearch /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview", label: "Interview", icon: <MessageSquare />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/export-exact-pdf", label: "Export Exact PDF", icon: <FileDown />},
                                            { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/export-statements", label: "Export Statements", icon: <FileText />},
                                            { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/interview-results", label: "Interview Results", icon: <BarChart2 />},
                                        ]},
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/training", label: "Training", icon: <ClipboardPenLine /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/connecting", label: "Connecting", icon: <Link2 /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/contracts", label: "Contracts", icon: <FileText />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/contracts/export", label: "Export Contracts", icon: <FileDown />},
                                            { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/contracts/view", label: "View Contracts", icon: <Eye />}
                                        ] },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/database", label: "Database", icon: <Database /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/double-benefits", label: "Double Benefits", icon: <Layers /> },
                                    ]},
                                    { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center", label: "Education & Payment Center", icon: <Home />, subItems: [
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/add-center", label: "Add Center", icon: <Plus /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/add-locations", label: "Add Locations", icon: <Plus /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/edit-center", label: "Edit Center", icon: <Edit /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/modification", label: "Modification", icon: <Wrench /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/upload-centers", label: "Upload Centers", icon: <Upload /> },
                                    ]}
                                ]
                            },
                             {
                                href: "/meal-system/monitoring/implementation/process", label: "Process", icon: <Activity />, subItems: [
                                   { href: "/meal-system/monitoring/implementation/process/monthly-health-sessions", label: "Monthly Health Sessions", icon: <HeartPulse />, subItems: [
                                      { href: "/meal-system/monitoring/implementation/process/monthly-health-sessions/upload", label: "Upload", icon: <Upload /> },
                                      { href: "/meal-system/monitoring/implementation/process/monthly-health-sessions/dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
                                      { href: "/meal-system/monitoring/implementation/process/monthly-health-sessions/database", label: "Database", icon: <Database /> },
                                   ]},
                                   { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement", label: "Cash Assistance Disbursement", icon: <DollarSign />, subItems: [
                                       { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries", label: "Beneficiaries", icon: <Users />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/upload", label: "Upload", icon: <Upload />},
                                            { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/dashboard", label: "Dashboard", icon: <LayoutDashboard />},
                                            { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/database", label: "Database", icon: <Database />},
                                       ]},
                                       { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/educators", label: "Educators", icon: <UserCheck />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/educators/upload", label: "Upload", icon: <Upload />},
                                            { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/educators/dashboard", label: "Dashboard", icon: <LayoutDashboard />},
                                            { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/educators/database", label: "Database", icon: <Database />},
                                       ]},
                                   ]},
                                   { href: "/meal-system/monitoring/implementation/process/CMAM-cases", label: "CMAM Cases", icon: <Stethoscope />, subItems: [
                                      { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries", label: "Beneficiaries", icon: <Users />, subItems: [
                                          { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening", label: "Screening", icon: <ScanSearch />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/preparing", label: "Preparing", icon: <ListChecks /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/database", label: "Database", icon: <Database /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/export", label: "Export", icon: <FileDown /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/entry", label: "Entry", icon: <FileEdit /> },
                                          ]},
                                          { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/confirmation", label: "Confirmation", icon: <ClipboardCheck />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/confirmation/entry", label: "Entry", icon: <FileEdit /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/confirmation/export", label: "Export", icon: <FileDown /> },
                                          ]},
                                          { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/referral", label: "Referral", icon: <Send />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/referral/export", label: "Export", icon: <FileDown /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/referral/data-entry", label: "Data Entry", icon: <FileEdit /> },
                                          ]},
                                      ]},
                                      { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children", label: "Children", icon: <Baby />, subItems: [
                                          { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/screening", label: "Screening", icon: <ScanSearch />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/preparing", label: "Preparing", icon: <ListChecks /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/database", label: "Database", icon: <Database /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/export", label: "Export", icon: <FileDown /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/entry", label: "Entry", icon: <FileEdit /> },
                                          ]},
                                          { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/confirmation", label: "Confirmation", icon: <ClipboardCheck />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/confirmation/entry", label: "Entry", icon: <FileEdit /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/confirmation/export", label: "Export", icon: <FileDown /> },
                                          ]},
                                          { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/referral", label: "Referral", icon: <Send />, subItems: [
                                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/referral/export", label: "Export Statements", icon: <FileText /> },
                                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/referral/entry", label: "Data Entry", icon: <FileEdit /> },
                                          ]},
                                      ]},
                                      { href: "/meal-system/monitoring/implementation/process/CMAM-cases/health-worker-data", label: "Health Worker Data", icon: <Stethoscope />}
                                   ] }
                                ]
                            },
                             { href: "/meal-system/monitoring/implementation/results", label: "Results", icon: <BarChart /> },
                             { href: "/meal-system/monitoring/implementation/compliance", label: "Compliance", icon: <ShieldCheck /> },
                             { href: "/meal-system/monitoring/implementation/context", label: "Context", icon: <Globe /> },
                             { href: "/meal-system/monitoring/implementation/financial", label: "Financial", icon: <DollarSign /> },
                             { href: "/meal-system/monitoring/implementation/organizational", label: "Organizational", icon: <Building /> },
                             { href: "/meal-system/monitoring/implementation/enrollment", label: "Enrollment", icon: <UserCheck />, subItems: [
                                  { href: "/meal-system/monitoring/implementation/enrollment/create-id-cards", label: "Create ID Cards", icon: <FileText /> },
                                  { href: "/meal-system/monitoring/implementation/enrollment/create-sheets", label: "Create Sheets", icon: <Sheet /> },
                                  { href: "/meal-system/monitoring/implementation/enrollment/review", label: "Review", icon: <Microscope />, subItems: [
                                      { href: "/meal-system/monitoring/implementation/enrollment/review/upload", label: "Upload", icon: <Upload />},
                                      { href: "/meal-system/monitoring/implementation/enrollment/review/recommendation", label: "Recommendation", icon: <ThumbsUp />},
                                      { href: "/meal-system/monitoring/implementation/enrollment/review/dashboard", label: "Dashboard", icon: <LayoutDashboard />},
                                      { href: "/meal-system/monitoring/implementation/enrollment/review/database", label: "Database", icon: <Database />},
                                      { href: "/meal-system/monitoring/implementation/enrollment/review/download", label: "Download", icon: <FileDown />},
                                  ]},
                             ]},
                        ]
                    },
                    { href: "/meal-system/monitoring/closure", label: "Closure", icon: <Flag /> },
                ]
            },
            { href: "/meal-system/evaluation", label: "Evaluation", icon: <ClipboardCheck /> },
            { href: "/meal-system/analysis", label: "Analysis", icon: <PieChart /> },
            { href: "/meal-system/reporting", label: "Reporting", icon: <FileText /> },
            { href: "/meal-system/risk", label: "Risk", icon: <ShieldAlert /> },
            { href: "/meal-system/compliant", label: "Compliant", icon: <MessageSquareWarning /> },
            { href: "/meal-system/indicator", label: "Indicator", icon: <Target /> },
            { href: "/meal-system/settings", label: "Settings", icon: <Settings /> },
        ]
    },
    { href: "/file-editor", label: "File Editor", icon: <FileEdit /> },
    { href: "/export-folders", label: "Export Folders", icon: <FileDown /> },
    { href: "/style-guide", label: "Style Guide", icon: <Palette /> },
    { href: "/system-architecture", label: "System Architecture", icon: <BrainCircuit /> },
];

const RecursiveNavGroup = ({ item, pathname, isCollapsed }: { item: any, pathname: string, isCollapsed: boolean }) => {
    const isGroupOrChildActive = item.subItems?.some((l: any) => pathname.startsWith(l.href)) || pathname === item.href;
    const [isOpen, setIsOpen] = useState(isGroupOrChildActive);

    useEffect(() => {
        if (isGroupOrChildActive) {
            setIsOpen(true);
        }
    }, [isGroupOrChildActive, pathname]);

    if (!item.subItems) {
        return <NavLink href={item.href} icon={item.icon} label={item.label} isActive={pathname === item.href} isCollapsed={isCollapsed} />;
    }

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className={cn("flex w-full items-center rounded-lg transition-colors hover:bg-muted", pathname === item.href && "bg-primary/10", isGroupOrChildActive && "text-primary")}>
                <Link href={item.href} className="flex-1">
                    <div className={cn("flex items-center gap-3 px-3 py-2 text-muted-foreground", isCollapsed && "justify-center", isGroupOrChildActive && "text-primary")}>
                        {item.icon}
                        <span className={cn("whitespace-nowrap", isCollapsed && "hidden")}>{item.label}</span>
                    </div>
                </Link>
                {!isCollapsed && (
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-9 p-0">
                            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
                            <span className="sr-only">Toggle</span>
                        </Button>
                    </CollapsibleTrigger>
                )}
            </div>
            <CollapsibleContent className={cn("space-y-1 py-1", !isCollapsed && "pl-4")}>
                {item.subItems.map((subItem: any) => (
                    <RecursiveNavGroup key={subItem.href} item={subItem} pathname={pathname} isCollapsed={isCollapsed} />
                ))}
            </CollapsibleContent>
        </Collapsible>
    );
};


export function LayoutProvider({ children, year }: { children: React.ReactNode, year: number }) {
  const currentPathname = usePathname();
  const [pathname, setPathname] = useState(currentPathname);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { t, isLoading: isTranslationLoading } = useTranslation();

  useEffect(() => {
    setPathname(currentPathname);
  }, [currentPathname]);

  const getPageTitle = (items: any[], path: string): string => {
    for (const item of items) {
        if (item.href === path) {
            return item.label;
        }
        if (path.startsWith(item.href) && item.subItems) {
            const subTitle = getPageTitle(item.subItems, path);
            // If the subtitle is not the parent's name, we found a more specific match
            if (subTitle !== item.label) return subTitle;
        }
    }
    const pathSegments = path.split('/').filter(Boolean);
    return pathSegments.length > 0 ? pathSegments.map(s => s.replace(/-/g, ' ')).join(' > ') : 'Dashboard';
  };

  const pageTitle = getPageTitle(navItems, pathname);

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
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {isTranslationLoading ? (
            Array.from({length: 10}).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          ) : (
            navItems.map(item => (
                <RecursiveNavGroup key={item.href} item={item} pathname={pathname} isCollapsed={isCollapsed} />
            ))
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
