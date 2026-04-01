
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
  FileText,
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
  PieChart,
  ClipboardCheck,
  MessageSquareWarning,
  ShieldAlert,
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

const NavLink = ({ href, icon, label, isActive, isCollapsed }: { href: string; icon: React.ReactNode; label: string; isActive: boolean, isCollapsed: boolean }) => {
    const { direction } = useLanguage();
    return (
        <Link
        href={href}
        className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted",
            isActive && "bg-primary/10 text-primary font-semibold",
            isCollapsed && "justify-center",
            direction === 'rtl' && 'flex-row-reverse'
        )}
        title={isCollapsed ? label : undefined}
        >
        {icon}
        <span className={cn("whitespace-nowrap", isCollapsed && "hidden")}>{label}</span>
        </Link>
    );
};

const navItems = [
    { href: "/", labelKey: "sidebar.dashboard", icon: <Home /> },
    {
        href: "/meal-system", labelKey: "sidebar.mealSystem", icon: <Briefcase />,
        subItems: [
            {
                href: "/meal-system/project", labelKey: "sidebar.projectManagement", icon: <Briefcase />, subItems: [
                    { href: "/meal-system/project/dashboard", labelKey: "sidebar.dashboard", icon: <LayoutDashboard /> },
                    { href: "/meal-system/project/details", labelKey: "sidebar.details", icon: <Eye /> },
                    { href: "/meal-system/project/add", labelKey: "sidebar.addProject", icon: <Plus /> },
                    { href: "/meal-system/project/plan", labelKey: "sidebar.plan", icon: <CalendarCheck />, subItems: [
                        { href: "/meal-system/project/plan/add-task", labelKey: "sidebar.addTask", icon: <Plus /> },
                        { href: "/meal-system/project/plan/edit-task", labelKey: "sidebar.editTask", icon: <Edit /> },
                    ]},
                    { href: "/meal-system/project/logframe", labelKey: "sidebar.logframe", icon: <ListChecks />, subItems: [
                        { href: "/meal-system/project/logframe/add", labelKey: "sidebar.add", icon: <Plus /> },
                        { href: "/meal-system/project/logframe/edit", labelKey: "sidebar.edit", icon: <Edit /> },
                    ]},
                ]
            },
            {
                href: "/meal-system/monitoring", labelKey: "sidebar.monitoring", icon: <Monitor />,
                subItems: [
                    { href: "/meal-system/monitoring/initiation-and-planning", labelKey: "sidebar.initiation", icon: <ClipboardList />, subItems: [
                        { href: "/meal-system/monitoring/initiation-and-planning/purpose-and-scope", labelKey: "sidebar.purpose", icon: <Target />, subItems: [
                           { href: "/meal-system/monitoring/initiation-and-planning/purpose-and-scope/add", labelKey: "sidebar.add", icon: <Plus /> },
                        ]},
                        { href: "/meal-system/monitoring/initiation-and-planning/data-collection", labelKey: "sidebar.dataCollection", icon: <Database />, subItems: [
                           { href: "/meal-system/monitoring/initiation-and-planning/data-collection/itt", labelKey: "sidebar.itt", icon: <Sheet />, subItems: [
                             { href: "/meal-system/monitoring/initiation-and-planning/data-collection/itt/edit", labelKey: "sidebar.edit", icon: <Edit /> },
                           ] },
                        ]},
                        { href: "/meal-system/monitoring/initiation-and-planning/data-analysis", labelKey: "sidebar.dataAnalysis", icon: <PieChart /> },
                        { href: "/meal-system/monitoring/initiation-and-planning/reporting", labelKey: "sidebar.reporting", icon: <FileText /> },
                        { href: "/meal-system/monitoring/initiation-and-planning/hr", labelKey: "sidebar.hr", icon: <Users /> },
                        { href: "/meal-system/monitoring/initiation-and-planning/budget", labelKey: "sidebar.budget", icon: <DollarSign /> },
                        { href: "/meal-system/monitoring/initiation-and-planning/me-plan-table", labelKey: "sidebar.mePlanTable", icon: <Table />, subItems: [
                             { href: "/meal-system/monitoring/initiation-and-planning/me-plan-table/add", labelKey: "sidebar.add", icon: <Plus /> },
                        ]},
                        { href: "/meal-system/monitoring/initiation-and-planning/prepare-indicators", labelKey: "sidebar.prepareIndicators", icon: <Target />, subItems: [
                             { href: "/meal-system/monitoring/initiation-and-planning/prepare-indicators/add", labelKey: "sidebar.add", icon: <Plus /> },
                        ]},
                        { href: "/meal-system/monitoring/initiation-and-planning/sampling-calculator", labelKey: "sidebar.samplingCalculator", icon: <Calculator /> },
                    ]},
                    {
                        href: "/meal-system/monitoring/implementation", labelKey: "sidebar.implementation", icon: <PlayCircle />,
                        subItems: [
                            {
                                href: "/meal-system/monitoring/implementation/beneficiary-monitoring", labelKey: "sidebar.beneficiaryMonitoring", icon: <Users />, subItems: [
                                    { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries", labelKey: "sidebar.beneficiaries", icon: <Users />, subItems: [
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/upload", labelKey: "sidebar.upload", icon: <Upload /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/correction", labelKey: "sidebar.correction", icon: <Wrench /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/review", labelKey: "sidebar.review", icon: <Microscope /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/audit", labelKey: "sidebar.audit", icon: <ClipboardList /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/report", labelKey: "sidebar.report", icon: <BarChartHorizontal /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/export", labelKey: "sidebar.export", icon: <FileDown /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/database", labelKey: "sidebar.database", icon: <Database /> },
                                    ]},
                                    { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators", labelKey: "sidebar.communityEducators", icon: <UserCheck />, subItems: [
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/selection", labelKey: "sidebar.selection", icon: <UserSearch /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview", labelKey: "sidebar.interview", icon: <MessageSquare />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/export-exact-pdf", labelKey: "sidebar.exportExactPdf", icon: <FileDown />},
                                            { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/export-statements", labelKey: "sidebar.exportStatements", icon: <FileText />},
                                            { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/interview-results", labelKey: "sidebar.interviewResults", icon: <BarChart2 />},
                                        ]},
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/training", labelKey: "sidebar.training", icon: <ClipboardPenLine /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/connecting", labelKey: "sidebar.connecting", icon: <Link2 /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/contracts", labelKey: "sidebar.contracts", icon: <FileText />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/contracts/export", labelKey: "sidebar.exportContracts", icon: <FileDown />},
                                            { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/contracts/view", labelKey: "sidebar.viewContracts", icon: <Eye />}
                                        ] },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/database", labelKey: "sidebar.database", icon: <Database /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/double-benefits", labelKey: "sidebar.doubleBenefits", icon: <Layers /> },
                                    ]},
                                    { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center", labelKey: "sidebar.educationCenter", icon: <Home />, subItems: [
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/add-center", labelKey: "sidebar.addCenter", icon: <Plus /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/add-locations", labelKey: "sidebar.addLocations", icon: <Plus /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/edit-center", labelKey: "sidebar.editCenter", icon: <Edit /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/modification", labelKey: "sidebar.modification", icon: <Wrench /> },
                                        { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/upload-centers", labelKey: "sidebar.uploadCenters", icon: <Upload /> },
                                    ]}
                                ]
                            },
                             {
                                href: "/meal-system/monitoring/implementation/process", labelKey: "sidebar.process", icon: <Activity />, subItems: [
                                   { href: "/meal-system/monitoring/implementation/process/monthly-health-sessions", labelKey: "sidebar.healthSessions", icon: <HeartPulse />, subItems: [
                                      { href: "/meal-system/monitoring/implementation/process/monthly-health-sessions/upload", labelKey: "sidebar.upload", icon: <Upload /> },
                                      { href: "/meal-system/monitoring/implementation/process/monthly-health-sessions/dashboard", labelKey: "sidebar.dashboard", icon: <LayoutDashboard /> },
                                      { href: "/meal-system/monitoring/implementation/process/monthly-health-sessions/database", labelKey: "sidebar.database", icon: <Database /> },
                                   ]},
                                   { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement", labelKey: "sidebar.disbursement", icon: <DollarSign />, subItems: [
                                       { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries", labelKey: "sidebar.beneficiaries", icon: <Users />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/upload", labelKey: "sidebar.upload", icon: <Upload />},
                                            { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/dashboard", labelKey: "sidebar.dashboard", icon: <LayoutDashboard />},
                                            { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/database", labelKey: "sidebar.database", icon: <Database />},
                                       ]},
                                       { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/educators", labelKey: "sidebar.educators", icon: <UserCheck />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/educators/upload", labelKey: "sidebar.upload", icon: <Upload />},
                                            { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/educators/dashboard", labelKey: "sidebar.dashboard", icon: <LayoutDashboard />},
                                            { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/educators/database", labelKey: "sidebar.database", icon: <Database />},
                                       ]},
                                   ]},
                                   { href: "/meal-system/monitoring/implementation/process/CMAM-cases", labelKey: "sidebar.cmamCases", icon: <Stethoscope />, subItems: [
                                      { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries", labelKey: "sidebar.beneficiaries", icon: <Users />, subItems: [
                                          { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening", labelKey: "sidebar.screening", icon: <ScanSearch />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/preparing", labelKey: "sidebar.preparing", icon: <ListChecks /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/database", labelKey: "sidebar.database", icon: <Database /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/export", labelKey: "sidebar.export", icon: <FileDown /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/entry", labelKey: "sidebar.entry", icon: <FileEdit /> },
                                          ]},
                                          { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/confirmation", labelKey: "sidebar.confirmation", icon: <ClipboardCheck />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/confirmation/entry", labelKey: "sidebar.entry", icon: <FileEdit /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/confirmation/export", labelKey: "sidebar.export", icon: <FileDown /> },
                                          ]},
                                          { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/referral", labelKey: "sidebar.referral", icon: <Send />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/referral/export", labelKey: "sidebar.export", icon: <FileDown /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/referral/data-entry", labelKey: "sidebar.dataEntry", icon: <FileEdit /> },
                                          ]},
                                      ]},
                                      { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children", labelKey: "sidebar.children", icon: <Baby />, subItems: [
                                          { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/screening", labelKey: "sidebar.screening", icon: <ScanSearch />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/preparing", labelKey: "sidebar.preparing", icon: <ListChecks /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/database", labelKey: "sidebar.database", icon: <Database /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/export", labelKey: "sidebar.export", icon: <FileDown /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/entry", labelKey: "sidebar.entry", icon: <FileEdit /> },
                                          ]},
                                          { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/confirmation", labelKey: "sidebar.confirmation", icon: <ClipboardCheck />, subItems: [
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/confirmation/entry", labelKey: "sidebar.entry", icon: <FileEdit /> },
                                            { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/confirmation/export", labelKey: "sidebar.export", icon: <FileDown /> },
                                          ]},
                                          { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/referral", labelKey: "sidebar.referral", icon: <Send />, subItems: [
                                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/referral/export", labelKey: "sidebar.exportStatements", icon: <FileText /> },
                                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/referral/entry", labelKey: "sidebar.dataEntry", icon: <FileEdit /> },
                                          ]},
                                      ]},
                                      { href: "/meal-system/monitoring/implementation/process/CMAM-cases/health-worker-data", labelKey: "sidebar.healthWorkerData"}
                                   ] }
                                ]
                            },
                             { href: "/meal-system/monitoring/implementation/results", labelKey: "sidebar.results", icon: <BarChart /> },
                             { href: "/meal-system/monitoring/implementation/compliance", labelKey: "sidebar.compliance", icon: <ShieldCheck /> },
                             { href: "/meal-system/monitoring/implementation/context", labelKey: "sidebar.context", icon: <Globe /> },
                             { href: "/meal-system/monitoring/implementation/financial", labelKey: "sidebar.financial", icon: <DollarSign /> },
                             { href: "/meal-system/monitoring/implementation/organizational", labelKey: "sidebar.organizational", icon: <Building /> },
                             { href: "/meal-system/monitoring/implementation/enrollment", labelKey: "sidebar.enrollment", icon: <UserCheck />, subItems: [
                                  { href: "/meal-system/monitoring/implementation/enrollment/create-id-cards", labelKey: "sidebar.createIdCards", icon: <FileText /> },
                                  { href: "/meal-system/monitoring/implementation/enrollment/create-sheets", labelKey: "sidebar.createSheets", icon: <Sheet /> },
                                  { href: "/meal-system/monitoring/implementation/enrollment/review", labelKey: "sidebar.review", icon: <Microscope />, subItems: [
                                      { href: "/meal-system/monitoring/implementation/enrollment/review/upload", labelKey: "sidebar.upload", icon: <Upload />},
                                      { href: "/meal-system/monitoring/implementation/enrollment/review/recommendation", labelKey: "sidebar.recommendation", icon: <ThumbsUp />},
                                      { href: "/meal-system/monitoring/implementation/enrollment/review/dashboard", labelKey: "sidebar.dashboard", icon: <LayoutDashboard />},
                                      { href: "/meal-system/monitoring/implementation/enrollment/review/database", labelKey: "sidebar.database", icon: <Database />},
                                      { href: "/meal-system/monitoring/implementation/enrollment/review/download", labelKey: "sidebar.download", icon: <FileDown />},
                                  ]},
                             ]},
                        ]
                    },
                    { href: "/meal-system/monitoring/closure", labelKey: "sidebar.closure", icon: <Flag /> },
                ]
            },
            { href: "/meal-system/evaluation", labelKey: "sidebar.evaluation", icon: <ClipboardCheck /> },
            { href: "/meal-system/analysis", labelKey: "sidebar.analysis", icon: <PieChart /> },
            { href: "/meal-system/reporting", labelKey: "sidebar.reporting", icon: <FileText /> },
            { href: "/meal-system/risk", labelKey: "sidebar.risk", icon: <ShieldAlert /> },
            { href: "/meal-system/compliant", labelKey: "sidebar.compliant", icon: <MessageSquareWarning /> },
            { href: "/meal-system/indicator", labelKey: "sidebar.indicator", icon: <Target /> },
            { href: "/meal-system/settings", labelKey: "sidebar.settings", icon: <Settings /> },
        ]
    },
    { href: "/file-editor", labelKey: "sidebar.fileEditor", icon: <FileEdit /> },
    { href: "/export-folders", labelKey: "sidebar.exportFolders", icon: <FileDown /> },
    { href: "/style-guide", labelKey: "sidebar.styleGuide", icon: <Palette /> },
    { href: "/system-architecture", labelKey: "sidebar.systemArchitecture", icon: <BrainCircuit /> },
];

const RecursiveNavGroup = ({ item, pathname, isCollapsed }: { item: any, pathname: string, isCollapsed: boolean }) => {
    const { t } = useTranslation();
    const { direction } = useLanguage();
    const isGroupOrChildActive = item.subItems?.some((l: any) => pathname.startsWith(l.href)) || pathname === item.href;
    const [isOpen, setIsOpen] = useState(isGroupOrChildActive);

    useEffect(() => {
        if (isGroupOrChildActive) {
            setIsOpen(true);
        }
    }, [isGroupOrChildActive, pathname]);

    if (!item.subItems) {
        return <NavLink href={item.href} icon={item.icon} label={t(item.labelKey)} isActive={pathname === item.href} isCollapsed={isCollapsed} />;
    }

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className={cn("flex w-full items-center rounded-lg transition-colors hover:bg-muted", pathname === item.href && "bg-primary/10", isGroupOrChildActive && "text-primary")}>
                <Link href={item.href} className="flex-1">
                    <div className={cn("flex items-center gap-3 px-3 py-2 text-muted-foreground", isCollapsed && "justify-center", isGroupOrChildActive && "text-primary", direction === 'rtl' && 'flex-row-reverse')}>
                        {item.icon}
                        <span className={cn("whitespace-nowrap", isCollapsed && "hidden")}>{t(item.labelKey)}</span>
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
            <CollapsibleContent className={cn("space-y-1 py-1", !isCollapsed && (direction === 'rtl' ? 'pr-4' : 'pl-4'))}>
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
  const { direction } = useLanguage();

  useEffect(() => {
    setPathname(currentPathname);
  }, [currentPathname]);

  const getPageTitle = (items: any[], path: string): string => {
    for (const item of items) {
        if (item.href === path) {
            return t(item.labelKey);
        }
        if (path.startsWith(item.href) && item.subItems) {
            const subTitle = getPageTitle(item.subItems, path);
            if (subTitle !== t(item.labelKey)) return subTitle;
        }
    }
    const pathSegments = path.split('/').filter(Boolean);
    return pathSegments.length > 0 ? pathSegments.map(s => s.replace(/-/g, ' ')).join(' > ') : t('sidebar.dashboard');
  };

  const pageTitle = getPageTitle(navItems, pathname);

  return (
    <div className="flex min-h-screen" dir={direction}>
      <aside
        className={cn(
          "bg-card text-card-foreground border-border transition-all duration-300 ease-in-out flex flex-col fixed h-full z-50",
          isCollapsed ? "w-20" : "w-64",
          direction === 'rtl' ? 'border-l right-0' : 'border-r left-0'
        )}
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
      >
        <div className={cn("flex items-center justify-between p-4 border-b h-14", direction === 'rtl' ? 'border-l' : 'border-r')}>
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
        <div className={cn("mt-auto p-4 border-t", direction === 'rtl' ? 'border-l' : 'border-r')}>
            <div className={cn("text-xs text-muted-foreground", isCollapsed && "text-center")}>
                 © {year}
              </div>
        </div>
      </aside>

      <div className={cn("flex flex-col flex-1 transition-all duration-300 ease-in-out", 
        isCollapsed 
            ? (direction === 'rtl' ? 'pr-20' : 'pl-20')
            : (direction === 'rtl' ? 'pr-64' : 'pl-64')
      )}>
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
