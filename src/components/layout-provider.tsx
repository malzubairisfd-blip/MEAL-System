"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Upload, Microscope, ClipboardList, Home, Settings, FileDown, Globe,
  BarChartHorizontal, Wrench, Briefcase, ListChecks, Monitor, Target,
  Palette, Sheet, ChevronDown, Users, FileEdit, BrainCircuit,
  LayoutDashboard, Eye, Plus, CalendarCheck, Edit, PlayCircle, Flag,
  BarChart, Activity, ShieldCheck, DollarSign, Building, Table,
  Calculator, UserSearch, MessageSquare, ClipboardPenLine, Network,
  FileText, Layers, Link2, User, HeartPulse, Stethoscope, ScanSearch,
  Send, UserCheck, ThumbsUp, Hand, Wallet, CreditCard, BarChart2,
  Menu, PanelLeft, PanelRight, Baby, Database, PieChart,
  MessageSquareWarning, ShieldAlert, ClipboardCheck, ArrowLeft,
  ArrowRight, Star, Search
} from "lucide-react";

import { useTranslation } from "@/hooks/use-translation";
import { useLanguage } from "@/context/language-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// --------------------------------------------------------
// Types & Nav Items
// --------------------------------------------------------
type NavItem = {
  href: string;
  labelKey: string;
  icon?: React.ReactNode;
  subItems?: NavItem[];
};

const navItems: NavItem[] = [
  { href: "/", labelKey: "sidebar.dashboard", icon: <Home /> },
  {
    href: "/meal-system", labelKey: "sidebar.mealSystem", icon: <Briefcase />,
    subItems: [
      {
        href: "/meal-system/project", labelKey: "sidebar.projectManagement", icon: <Briefcase />, subItems: [
          { href: "/meal-system/project/dashboard", labelKey: "sidebar.dashboard", icon: <LayoutDashboard /> },
          { href: "/meal-system/project/details", labelKey: "sidebar.details", icon: <Eye /> },
          { href: "/meal-system/project/add", labelKey: "sidebar.addProject", icon: <Plus /> },
          {
            href: "/meal-system/project/plan", labelKey: "sidebar.plan", icon: <CalendarCheck />, subItems: [
              { href: "/meal-system/project/plan/add-task", labelKey: "sidebar.addTask", icon: <Plus /> },
              { href: "/meal-system/project/plan/edit-task", labelKey: "sidebar.editTask", icon: <Edit /> },
            ]
          },
          {
            href: "/meal-system/project/logframe", labelKey: "sidebar.logframe", icon: <ListChecks />, subItems: [
              { href: "/meal-system/project/logframe/add", labelKey: "sidebar.add", icon: <Plus /> },
              { href: "/meal-system/project/logframe/edit", labelKey: "sidebar.edit", icon: <Edit /> },
            ]
          },
        ]
      },
      {
        href: "/meal-system/monitoring", labelKey: "sidebar.monitoring", icon: <Monitor />,
        subItems: [
          {
            href: "/meal-system/monitoring/initiation-and-planning", labelKey: "sidebar.initiation", icon: <ClipboardList />, subItems: [
              {
                href: "/meal-system/monitoring/initiation-and-planning/purpose-and-scope", labelKey: "sidebar.purpose", icon: <Target />, subItems: [
                  { href: "/meal-system/monitoring/initiation-and-planning/purpose-and-scope/add", labelKey: "sidebar.add", icon: <Plus /> },
                ]
              },
              {
                href: "/meal-system/monitoring/initiation-and-planning/data-collection", labelKey: "sidebar.dataCollection", icon: <Database />, subItems: [
                  {
                    href: "/meal-system/monitoring/initiation-and-planning/data-collection/itt", labelKey: "sidebar.itt", icon: <Sheet />, subItems: [
                      { href: "/meal-system/monitoring/initiation-and-planning/data-collection/itt/edit", labelKey: "sidebar.edit", icon: <Edit /> },
                    ]
                  },
                ]
              },
              { href: "/meal-system/monitoring/initiation-and-planning/data-analysis", labelKey: "sidebar.dataAnalysis", icon: <PieChart /> },
              { href: "/meal-system/monitoring/initiation-and-planning/reporting", labelKey: "sidebar.reporting", icon: <FileText /> },
              { href: "/meal-system/monitoring/initiation-and-planning/hr", labelKey: "sidebar.hr", icon: <Users /> },
              { href: "/meal-system/monitoring/initiation-and-planning/budget", labelKey: "sidebar.budget", icon: <DollarSign /> },
              {
                href: "/meal-system/monitoring/initiation-and-planning/me-plan-table", labelKey: "sidebar.mePlanTable", icon: <Table />, subItems: [
                  { href: "/meal-system/monitoring/initiation-and-planning/me-plan-table/add", labelKey: "sidebar.add", icon: <Plus /> },
                ]
              },
              {
                href: "/meal-system/monitoring/initiation-and-planning/prepare-indicators", labelKey: "sidebar.prepareIndicators", icon: <Target />, subItems: [
                  { href: "/meal-system/monitoring/initiation-and-planning/prepare-indicators/add", labelKey: "sidebar.add", icon: <Plus /> },
                ]
              },
              { href: "/meal-system/monitoring/initiation-and-planning/sampling-calculator", labelKey: "sidebar.samplingCalculator", icon: <Calculator /> },
            ]
          },
          {
            href: "/meal-system/monitoring/implementation", labelKey: "sidebar.implementation", icon: <PlayCircle />,
            subItems: [
              {
                href: "/meal-system/monitoring/implementation/beneficiary-monitoring", labelKey: "sidebar.beneficiaryMonitoring", icon: <Users />, subItems: [
                  {
                    href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries", labelKey: "sidebar.beneficiaries", icon: <Users />, subItems: [
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/upload", labelKey: "sidebar.upload", icon: <Upload /> },
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/correction", labelKey: "sidebar.correction", icon: <Wrench /> },
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/review", labelKey: "sidebar.review", icon: <Microscope /> },
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/audit", labelKey: "sidebar.audit", icon: <ClipboardList /> },
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/report", labelKey: "sidebar.report", icon: <BarChartHorizontal /> },
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/export", labelKey: "sidebar.export", icon: <FileDown /> },
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/database", labelKey: "sidebar.database", icon: <Database /> },
                    ]
                  },
                  {
                    href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators", labelKey: "sidebar.communityEducators", icon: <UserCheck />, subItems: [
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/selection", labelKey: "sidebar.selection", icon: <UserSearch /> },
                      {
                        href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview", labelKey: "sidebar.interview", icon: <MessageSquare />, subItems: [
                          { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/export-exact-pdf", labelKey: "sidebar.exportExactPdf", icon: <FileDown /> },
                          { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/export-statements", labelKey: "sidebar.exportStatements", icon: <FileText /> },
                          { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/interview-results", labelKey: "sidebar.interviewResults", icon: <BarChart2 /> },
                        ]
                      },
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/training", labelKey: "sidebar.training", icon: <ClipboardPenLine /> },
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/connecting", labelKey: "sidebar.connecting", icon: <Link2 /> },
                      {
                        href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/contracts", labelKey: "sidebar.contracts", icon: <FileText />, subItems: [
                          { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/contracts/export", labelKey: "sidebar.exportContracts", icon: <FileDown /> },
                          { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/contracts/view", labelKey: "sidebar.viewContracts", icon: <Eye /> }
                        ]
                      },
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/database", labelKey: "sidebar.database", icon: <Database /> },
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/double-benefits", labelKey: "sidebar.doubleBenefits", icon: <Layers /> },
                    ]
                  },
                  {
                    href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center", labelKey: "sidebar.educationCenter", icon: <Home />, subItems: [
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/add-center", labelKey: "sidebar.addCenter", icon: <Plus /> },
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/add-locations", labelKey: "sidebar.addLocations", icon: <Plus /> },
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/edit-center", labelKey: "sidebar.editCenter", icon: <Edit /> },
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/modification", labelKey: "sidebar.modification", icon: <Wrench /> },
                      { href: "/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/upload-centers", labelKey: "sidebar.uploadCenters", icon: <Upload /> },
                    ]
                  }
                ]
              },
              {
                href: "/meal-system/monitoring/implementation/process", labelKey: "sidebar.process", icon: <Activity />, subItems: [
                  {
                    href: "/meal-system/monitoring/implementation/process/monthly-health-sessions", labelKey: "sidebar.healthSessions", icon: <HeartPulse />, subItems: [
                      { href: "/meal-system/monitoring/implementation/process/monthly-health-sessions/upload", labelKey: "sidebar.upload", icon: <Upload /> },
                      { href: "/meal-system/monitoring/implementation/process/monthly-health-sessions/dashboard", labelKey: "sidebar.dashboard", icon: <LayoutDashboard /> },
                      { href: "/meal-system/monitoring/implementation/process/monthly-health-sessions/database", labelKey: "sidebar.database", icon: <Database /> },
                    ]
                  },
                  {
                    href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement", labelKey: "sidebar.disbursement", icon: <DollarSign />, subItems: [
                      {
                        href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries", labelKey: "sidebar.beneficiaries", icon: <Users />, subItems: [
                          { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/upload", labelKey: "sidebar.upload", icon: <Upload /> },
                          { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/dashboard", labelKey: "sidebar.dashboard", icon: <LayoutDashboard /> },
                          { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/database", labelKey: "sidebar.database", icon: <Database /> },
                        ]
                      },
                      {
                        href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/educators", labelKey: "sidebar.educators", icon: <UserCheck />, subItems: [
                          { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/educators/upload", labelKey: "sidebar.upload", icon: <Upload /> },
                          { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/educators/dashboard", labelKey: "sidebar.dashboard", icon: <LayoutDashboard /> },
                          { href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/educators/database", labelKey: "sidebar.database", icon: <Database /> },
                        ]
                      },
                    ]
                  },
                  {
                    href: "/meal-system/monitoring/implementation/process/CMAM-cases", labelKey: "sidebar.cmamCases", icon: <Stethoscope />, subItems: [
                      {
                        href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries", labelKey: "sidebar.beneficiaries", icon: <Users />, subItems: [
                          {
                            href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening", labelKey: "sidebar.screening", icon: <ScanSearch />, subItems: [
                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/preparing", labelKey: "sidebar.preparing", icon: <ListChecks /> },
                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/database", labelKey: "sidebar.database", icon: <Database /> },
                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/export", labelKey: "sidebar.export", icon: <FileDown /> },
                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/entry", labelKey: "sidebar.entry", icon: <FileEdit /> },
                            ]
                          },
                          {
                            href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/confirmation", labelKey: "sidebar.confirmation", icon: <ClipboardCheck />, subItems: [
                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/confirmation/entry", labelKey: "sidebar.entry", icon: <FileEdit /> },
                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/confirmation/export", labelKey: "sidebar.export", icon: <FileDown /> },
                            ]
                          },
                          {
                            href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/referral", labelKey: "sidebar.referral", icon: <Send />, subItems: [
                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/referral/export", labelKey: "sidebar.export", icon: <FileDown /> },
                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/referral/data-entry", labelKey: "sidebar.dataEntry", icon: <FileEdit /> },
                            ]
                          },
                        ]
                      },
                      {
                        href: "/meal-system/monitoring/implementation/process/CMAM-cases/children", labelKey: "sidebar.children", icon: <Baby />, subItems: [
                          {
                            href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/screening", labelKey: "sidebar.screening", icon: <ScanSearch />, subItems: [
                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/preparing", labelKey: "sidebar.preparing", icon: <ListChecks /> },
                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/database", labelKey: "sidebar.database", icon: <Database /> },
                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/export", labelKey: "sidebar.export", icon: <FileDown /> },
                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/entry", labelKey: "sidebar.entry", icon: <FileEdit /> },
                            ]
                          },
                          {
                            href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/confirmation", labelKey: "sidebar.confirmation", icon: <ClipboardCheck />, subItems: [
                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/confirmation/entry", labelKey: "sidebar.entry", icon: <FileEdit /> },
                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/confirmation/export", labelKey: "sidebar.export", icon: <FileDown /> },
                            ]
                          },
                          {
                            href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/referral", labelKey: "sidebar.referral", icon: <Send />, subItems: [
                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/referral/export", labelKey: "sidebar.exportStatements", icon: <FileText /> },
                              { href: "/meal-system/monitoring/implementation/process/CMAM-cases/children/referral/entry", labelKey: "sidebar.dataEntry", icon: <FileEdit /> },
                            ]
                          },
                        ]
                      },
                      { href: "/meal-system/monitoring/implementation/process/CMAM-cases/health-worker-data", labelKey: "sidebar.healthWorkerData" }
                    ]
                  }
                ]
              },
              { href: "/meal-system/monitoring/implementation/results", labelKey: "sidebar.results", icon: <BarChart /> },
              { href: "/meal-system/monitoring/implementation/compliance", labelKey: "sidebar.compliance", icon: <ShieldCheck /> },
              { href: "/meal-system/monitoring/implementation/context", labelKey: "sidebar.context", icon: <Globe /> },
              { href: "/meal-system/monitoring/implementation/financial", labelKey: "sidebar.financial", icon: <DollarSign /> },
              { href: "/meal-system/monitoring/implementation/organizational", labelKey: "sidebar.organizational", icon: <Building /> },
              {
                href: "/meal-system/monitoring/implementation/enrollment", labelKey: "sidebar.enrollment", icon: <UserCheck />, subItems: [
                  { href: "/meal-system/monitoring/implementation/enrollment/create-id-cards", labelKey: "sidebar.createIdCards", icon: <FileText /> },
                  { href: "/meal-system/monitoring/implementation/enrollment/create-sheets", labelKey: "sidebar.createSheets", icon: <Sheet /> },
                  {
                    href: "/meal-system/monitoring/implementation/enrollment/review", labelKey: "sidebar.review", icon: <Microscope />, subItems: [
                      { href: "/meal-system/monitoring/implementation/enrollment/review/upload", labelKey: "sidebar.upload", icon: <Upload /> },
                      { href: "/meal-system/monitoring/implementation/enrollment/review/recommendation", labelKey: "sidebar.recommendation", icon: <ThumbsUp /> },
                      { href: "/meal-system/monitoring/implementation/enrollment/review/dashboard", labelKey: "sidebar.dashboard", icon: <LayoutDashboard /> },
                      { href: "/meal-system/monitoring/implementation/enrollment/review/database", labelKey: "sidebar.database", icon: <Database /> },
                      { href: "/meal-system/monitoring/implementation/enrollment/review/download", labelKey: "sidebar.download", icon: <FileDown /> },
                    ]
                  },
                ]
              },
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

// --------------------------------------------------------
// Sub-Components
// --------------------------------------------------------

const NavLink = ({
  href,
  icon,
  label,
  isActive,
  isCollapsed,
  isFavorite,
  onToggleFavorite,
}: {
  href: string;
  icon?: React.ReactNode;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (href: string) => void;
}) => {
  const { direction } = useLanguage();

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-300",
        "text-muted-foreground hover:text-primary hover:bg-muted",
        isActive && "bg-primary/10 text-primary font-semibold",
        isCollapsed && "justify-center",
        direction === "rtl" && "flex-row-reverse"
      )}
      title={isCollapsed ? label : undefined}
    >
      <div
        className={cn(
          "flex items-center justify-center transition-all duration-300",
          isCollapsed && "w-10 h-10 rounded-full circle-animate",
          isActive && "bg-primary/20 icon-glow"
        )}
      >
        {icon}
      </div>

      <span className={cn("flex-1 whitespace-nowrap", isCollapsed && "hidden")}>
        {label}
      </span>

      {onToggleFavorite && !isCollapsed && (
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(href);
          }}
          className={cn(
            "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
            isFavorite && "opacity-100 text-yellow-500"
          )}
        >
          <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
        </Button>
      )}
    </Link>
  );
};

const RecursiveNavGroup = ({
  item,
  pathname,
  isCollapsed,
  favorites,
  onToggleFavorite
}: {
  item: NavItem;
  pathname: string;
  isCollapsed: boolean;
  favorites: string[];
  onToggleFavorite: (href: string) => void;
}) => {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const [isOpen, setIsOpen] = useState(isActive);

  if (!item.subItems || item.subItems.length === 0) {
    return (
      <NavLink
        href={item.href}
        icon={item.icon}
        label={t(item.labelKey)}
        isActive={pathname === item.href}
        isCollapsed={isCollapsed}
        isFavorite={favorites.includes(item.href)}
        onToggleFavorite={onToggleFavorite}
      />
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted",
          isActive && "text-primary font-semibold",
          isCollapsed && "justify-center",
          direction === "rtl" && "flex-row-reverse"
        )}
      >
        <div className={cn("flex items-center justify-center transition-all", isActive && "icon-glow text-primary")}>
          {item.icon}
        </div>
        <span className={cn("flex-1 whitespace-nowrap text-start", isCollapsed && "hidden")}>
          {t(item.labelKey)}
        </span>
        {!isCollapsed && (
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        )}
      </CollapsibleTrigger>
      {!isCollapsed && (
        <CollapsibleContent className={cn("mt-1 space-y-1", direction === "rtl" ? "mr-4 border-r-2" : "ml-4 border-l-2")}>
          {item.subItems.map((sub) => (
            <RecursiveNavGroup
              key={sub.href}
              item={sub}
              pathname={pathname}
              isCollapsed={isCollapsed}
              favorites={favorites}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
};

// --------------------------------------------------------
// Main Component
// --------------------------------------------------------

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { direction, setLanguage } = useLanguage();
  const { t } = useTranslation();

  // Sidebar States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");

  const effectiveOpen = isSidebarOpen || isHovered;

  // Sync Favorites with LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-favorites");
    if (saved) setFavorites(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar-favorites", JSON.stringify(favorites));
  }, [favorites]);

  // Command Palette Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        setIsCommandOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleFavorite = (href: string) => {
    setFavorites(prev => prev.includes(href) ? prev.filter(f => f !== href) : [...prev, href]);
  };

  // Helper: Flatten nav for search/command
  const flattenNav = (items: NavItem[]): NavItem[] =>
    items.flatMap(item => item.subItems ? [item, ...flattenNav(item.subItems)] : [item]);

  const allPages = flattenNav(navItems);

  // Search Logic
  const filterItems = (items: NavItem[]): NavItem[] => {
    return items.map(item => {
      const match = t(item.labelKey).toLowerCase().includes(search.toLowerCase());
      if (item.subItems) {
        const filteredSub = filterItems(item.subItems);
        if (filteredSub.length > 0 || match) return { ...item, subItems: filteredSub };
      }
      return match ? item : null;
    }).filter(Boolean) as NavItem[];
  };

  const filteredNav = search ? filterItems(navItems) : navItems;
  const commandResults = allPages.filter(p => t(p.labelKey).toLowerCase().includes(commandQuery.toLowerCase())).slice(0, 8);

  return (
    <div className="flex min-h-screen bg-background" dir={direction}>
      {/* SIDEBAR */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "fixed z-50 flex h-full flex-col border-border bg-card transition-all duration-300 ease-in-out",
          effectiveOpen ? "w-64" : "w-20",
          direction === "rtl" ? "right-0 border-l" : "left-0 border-r"
        )}
      >
        <div className="flex h-16 items-center border-b px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Briefcase className="h-6 w-6" />
            </div>
            {effectiveOpen && <span className="font-bold text-lg truncate">MEAL System</span>}
          </div>
        </div>

        {/* Sidebar Search */}
        <div className="p-3">
          <div className={cn("relative transition-all", !effectiveOpen && "opacity-0")}>
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border bg-muted/50 px-9 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-hide">
          {/* Favorites Section */}
          {favorites.length > 0 && effectiveOpen && !search && (
            <div className="mb-4">
              <p className="px-3 text-[10px] font-bold uppercase text-muted-foreground">Favorites</p>
              {allPages.filter(p => favorites.includes(p.href)).map(p => (
                <NavLink
                  key={`fav-${p.href}`}
                  href={p.href}
                  label={t(p.labelKey)}
                  icon={p.icon}
                  isActive={pathname === p.href}
                  isCollapsed={false}
                  isFavorite={true}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
              <div className="my-2 border-b mx-3" />
            </div>
          )}

          {filteredNav.map((item) => (
            <RecursiveNavGroup
              key={item.href}
              item={item}
              pathname={pathname}
              isCollapsed={!effectiveOpen}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </nav>
      </aside>

      {/* CONTENT AREA */}
      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-300",
          direction === "rtl"
            ? effectiveOpen ? "mr-64" : "mr-20"
            : effectiveOpen ? "ml-64" : "ml-20"
        )}
      >
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              {direction === "rtl" ? (
                isSidebarOpen ? <PanelRight /> : <PanelLeft />
              ) : (
                isSidebarOpen ? <PanelLeft /> : <PanelRight />
              )}
            </Button>
            <div className="h-4 w-px bg-border mx-2" />
            <span className="text-sm font-medium text-muted-foreground">
              {t('sidebar.mealSystem')} / {pathname.split('/').pop()}
            </span>
          </div>

          <div className="flex items-center gap-4">
             {/* Command Palette Trigger */}
            <Button
              variant="outline"
              className="hidden h-9 w-64 justify-between bg-muted/50 text-muted-foreground md:flex"
              onClick={() => setIsCommandOpen(true)}
            >
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <span className="text-xs">Jump to page...</span>
              </div>
              <kbd className="text-[10px]">CTRL K</kbd>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><Globe className="h-5 w-5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLanguage('en')}>English</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('ar')}>العربية</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>

      {/* COMMAND PALETTE UI */}
      {isCommandOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[15vh] backdrop-blur-sm" onClick={() => setIsCommandOpen(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-2xl animate-in fade-in slide-in-from-top-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center border-b px-4">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                autoFocus
                className="h-12 w-full bg-transparent px-3 outline-none text-sm"
                placeholder="Where would you like to go?"
                value={commandQuery}
                onChange={e => setCommandQuery(e.target.value)}
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {commandResults.map(res => (
                <div
                  key={res.href}
                  className="flex cursor-pointer items-center gap-3 rounded-lg p-3 hover:bg-muted"
                  onClick={() => { router.push(res.href); setIsCommandOpen(false); }}
                >
                  <div className="text-muted-foreground">{res.icon}</div>
                  <span className="text-sm">{t(res.labelKey)}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground opacity-50">{res.href}</span>
                </div>
              ))}
              {commandResults.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">No pages found.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}