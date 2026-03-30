"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Loader2,
  Database,
  FileText,
  Search,
  Activity,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Project {
  projectId: string;
  projectName: string;
}
interface HealthCenter {
  hc_id: string;
  hc_name: string;
}
interface Beneficiary {
  id: number;
  BENEF_ID: string;
  BENEF_NAME: string;
  hc_id: string;
  bnf_has_cmam_hc: string;
  next_cycle_c1?: string;
  next_cycle_c2?: string;
  next_cycle_c3?: string;
  hc_muac?: number;
  hc_muac_c1?: number;
  hc_muac_c2?: number;
  cure_rate_c1?: string;
  cure_rate_c2?: string;
  bnf_child_age_c1?: number;
  bnf_child_age_c2?: number;
  bnf_child_age_c3?: number;
  bnf_attend_c1?: string;
  bnf_attend_c2?: string;
  [key: string]: any;
}

const months = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "دسمبر",
];
const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
const days = Array.from({ length: 31 }, (_, i) => i + 1);

const formSchema = z
  .object({
    bnf_attend_c: z.enum(["نعم", "لا"], {
      errorMap: () => ({ message: "يرجى تحديد ما إذا حضر المستفيد." }),
    }),
    not_attend_reason_c: z.string().optional(),
    date_attend_c_day: z.string().optional(),
    date_attend_c_month: z.string().optional(),
    date_attend_c_year: z.string().optional(),
    bnf_isprev_ref_c: z.enum(["نعم", "لا"]).optional(),
    hc_muac_c_no: z.number().optional(),
    cmam_result_c_no: z.string().optional(),
    hc_muac_c: z.number().optional(),
    cmam_result_c: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.bnf_attend_c === "لا") {
      if (!data.not_attend_reason_c?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["not_attend_reason_c"],
          message: "يرجى توضيح سبب عدم الحضور.",
        });
      }
      return;
    }

    if (data.bnf_attend_c === "نعم") {
      if (!data.date_attend_c_day) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["date_attend_c_day"],
          message: "يرجى اختيار يوم الحضور.",
        });
      }
      if (!data.date_attend_c_month) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["date_attend_c_month"],
          message: "يرجى اختيار شهر الحضور.",
        });
      }
      if (!data.date_attend_c_year) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["date_attend_c_year"],
          message: "يرجى اختيار سنة الحضور.",
        });
      }
      if (!data.bnf_isprev_ref_c) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bnf_isprev_ref_c"],
          message: "يرجى تحديد ما إذا كانت المراجعة من دورة سابقة.",
        });
      } else if (data.bnf_isprev_ref_c === "لا") {
        if (data.hc_muac_c_no === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["hc_muac_c_no"],
            message: "يرجى ضبط قيمة MUAC للحالة الطبيعية.",
          });
        }
        if (!data.cmam_result_c_no?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["cmam_result_c_no"],
            message: "يرجى إدخال نتيجة المتابعة.",
          });
        }
      } else if (data.bnf_isprev_ref_c === "نعم") {
        if (data.hc_muac_c === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["hc_muac_c"],
            message: "يرجى ضبط قيمة MUAC للحالة المرضية.",
          });
        }
        if (!data.cmam_result_c?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["cmam_result_c"],
            message: "يرجى إدخال نتيجة سوء التغذية.",
          });
        }
      }
    }
  });

export default function EnhancedReferralDataEntryPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [config, setConfig] = useState({ projectId: "", followUpCycle: 1, followUpMonth: "" });
  const [healthCenters, setHealthCenters] = useState<HealthCenter[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selectedHealthCenterId, setSelectedHealthCenterId] = useState("");
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [hcSearch, setHcSearch] = useState("");
  const [beneficiarySearch, setBeneficiarySearch] = useState("");
  const [loading, setLoading] = useState({ projects: true, config: true, data: false, saving: false });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { hc_muac_c_no: 23, hc_muac_c: 17 },
  });

  const watchAttend = form.watch("bnf_attend_c");
  const watchHasMalnutrition = form.watch("bnf_isprev_ref_c");
  const isFormValid = form.formState.isValid;

  useEffect(() => {
    setLoading((p) => ({ ...p, projects: true, config: true }));
    Promise.all([
      fetch("/api/projects").then((res) => res.json()),
      fetch("/api/bnf-referral-cycle").then((res) => res.json()),
    ])
      .then(([projData, confData]) => {
        setProjects(projData);
        setConfig(confData);
        if (confData.projectId) handleProjectSelect(confData.projectId, confData);
      })
      .finally(() => setLoading((p) => ({ ...p, projects: false, config: false })));
  }, []);

  const handleProjectSelect = useCallback(
    async (projectId: string, currentConfig = config) => {
      setConfig((prev) => ({ ...prev, projectId }));
      setSelectedHealthCenterId("");
      setSelectedBeneficiary(null);

      if (!projectId) {
        setHealthCenters([]);
        setBeneficiaries([]);
        return;
      }

      setLoading((p) => ({ ...p, data: true }));
      try {
        const res = await fetch(`/api/bnf-cmam?projectId=${projectId}`);
        if (!res.ok) throw new Error("Failed to load CMAM data.");
        const allBnfs = await res.json();

        const cycle = currentConfig.followUpCycle;
        const qualifiedBnfs = allBnfs.filter((b: any) => {
          if (cycle === 1)
            return (
              b.bnf_has_cmam_hc === "نعم" &&
              (b.next_cycle_c1 === "Qualified" ||
                !b.next_cycle_c1 ||
                b.next_cycle_c1 === "Last Month Qualification")
            );
          if (cycle === 2)
            return (
              b.next_cycle_c2 === "Qualified" || b.next_cycle_c2 === "Last Month Qualification"
            );
          if (cycle === 3)
            return (
              b.next_cycle_c3 === "Qualified" || b.next_cycle_c3 === "Last Month Qualification"
            );
          return false;
        });

        setBeneficiaries(qualifiedBnfs);
        const uniqueHCs: HealthCenter[] = Array.from(
          new Map(
            qualifiedBnfs.map((item: any) => [item.hc_id, { hc_id: item.hc_id, hc_name: item.hc_name }])
          ).values()
        );
        setHealthCenters(uniqueHCs);
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading((p) => ({ ...p, data: false }));
      }
    },
    [toast, config]
  );

  const filteredHCs = useMemo(() => {
    if (!hcSearch) return healthCenters;
    return healthCenters.filter((hc) => hc.hc_name.toLowerCase().includes(hcSearch.toLowerCase()));
  }, [healthCenters, hcSearch]);

  const filteredBeneficiaries = useMemo(() => {
    let filtered = beneficiaries.filter((b) => b.hc_id === selectedHealthCenterId);
    if (beneficiarySearch) {
      const lowerSearch = beneficiarySearch.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          String(b.BENEF_ID).toLowerCase().includes(lowerSearch) ||
          b.BENEF_NAME.toLowerCase().includes(lowerSearch)
      );
    }
    return filtered;
  }, [beneficiaries, selectedHealthCenterId, beneficiarySearch]);

  const runCycleCalculations = (payload: any, bnf: Beneficiary, cycle: number) => {
    const p = { ...payload };
    const cmamResult = p[`cmam_result_c${cycle}`] || "";
    const isPrevRef = p[`bnf_isprev_ref_c${cycle}`];
    const attend = p[`bnf_attend_c${cycle}`];

    let currentMuac = parseFloat(p[`hc_muac_c${cycle}`] || 0);
    let prevMuac = 0;
    let cureRate = "";
    let nextCycle = "";

    if (cycle === 1) prevMuac = parseFloat(bnf.hc_muac?.toString() || "0");
    if (cycle === 2) prevMuac = parseFloat(bnf.hc_muac_c1?.toString() || "0");
    if (cycle === 3) prevMuac = parseFloat(bnf.hc_muac_c2?.toString() || "0");

    if (isPrevRef === "نعم") {
      const diff = currentMuac - prevMuac;
      if (diff < 0) {
        cureRate = "Negative";
        p[`negative_c${cycle}`] = diff;
      } else if (diff === 0) {
        cureRate = "No Improvement";
      } else if (diff > 0) {
        cureRate = "Positive";
        p[`positive_c${cycle}`] = diff;
      }
      p[`cure_rate_c${cycle}`] = cureRate;
    }

    if (cycle === 1) {
      if (currentMuac >= 23) nextCycle = "Disqualified";
      else if (bnf.bnf_child_age_c1 === 6) nextCycle = "Last Month Qualification";
      else if (
        [
          "شفاء",
          "الوفاة",
          "إنتهاء فترة الدعم / تخرج من برنامج سوء التغذية",
        ].includes(cmamResult)
      )
        nextCycle = "Last Month Qualification";
      else if (cureRate === "Negative" || cureRate === "No Improvement")
        nextCycle = "Last Month Qualification";
      else if (cureRate === "Positive") nextCycle = "Qualified";
    }

    if (cycle === 2) {
      if (bnf.hc_muac_c1 && bnf.hc_muac_c1 >= 23) nextCycle = "Disqualified";
      else if (currentMuac >= 23) nextCycle = "Disqualified";
      else if (
        (cureRate === "Negative" || cureRate === "No Improvement") &&
        (bnf.cure_rate_c1 === "Negative" || bnf.cure_rate_c1 === "No Improvement")
      )
        nextCycle = "Disqualified";
      else if (
        bnf.next_cycle_c1 === "Disqualified" ||
        bnf.next_cycle_c1 === "Last Month Qualification"
      )
        nextCycle = "Disqualified";
      else if (bnf.bnf_child_age_c2 === 6) nextCycle = "Last Month Qualification";
      else if (bnf.bnf_attend_c1 === "لا" && attend === "لا") nextCycle = "Last Month Qualification";
      else if (
        [
          "شفاء",
          "الوفاة",
          "إنتهاء فترة الدعم / تخرج من برنامج سوء التغذية",
        ].includes(cmamResult)
      )
        nextCycle = "Last Month Qualification";
      else if (cureRate === "Positive") nextCycle = "Qualified";
    }

    if (cycle === 3) {
      if (bnf.hc_muac_c1 && bnf.hc_muac_c1 >= 23) nextCycle = "Disqualified";
      else if (bnf.hc_muac_c2 && bnf.hc_muac_c2 >= 23) nextCycle = "Disqualified";
      else if (currentMuac >= 23) nextCycle = "Disqualified";
      else if (
        (cureRate === "Negative" || cureRate === "No Improvement") &&
        (bnf.cure_rate_c2 === "Negative" || bnf.cure_rate_c2 === "No Improvement")
      )
        nextCycle = "Disqualified";
      else if (
        bnf.next_cycle_c2 === "Disqualified" ||
        bnf.next_cycle_c2 === "Last Month Qualification"
      )
        nextCycle = "Disqualified";
      else if (bnf.bnf_attend_c1 === "لا" && bnf.bnf_attend_c2 === "لا") nextCycle = "Disqualified";
      else if (bnf.bnf_child_age_c3 === 6) nextCycle = "Last Month Qualification";
      else if (
        [
          "شفاء",
          "الوفاة",
          "إنتهاء فترة الدعم / تخرج من برنامج سوء التغذية",
        ].includes(cmamResult)
      )
        nextCycle = "Last Month Qualification";
      else if (cureRate === "Positive") nextCycle = "Qualified";
    }

    if (nextCycle) p[`next_cycle_c${cycle}`] = nextCycle;
    return p;
  };

  const moveToNextBeneficiary = useCallback(() => {
    form.reset({
      bnf_attend_c: undefined,
      not_attend_reason_c: "",
      bnf_isprev_ref_c: undefined,
      hc_muac_c_no: 23,
      hc_muac_c: 17,
    });
    const currentIndex = filteredBeneficiaries.findIndex((b) => b.id === selectedBeneficiary?.id);
    if (currentIndex !== -1 && currentIndex < filteredBeneficiaries.length - 1) {
      setSelectedBeneficiary(filteredBeneficiaries[currentIndex + 1]);
    } else {
      toast({
        title: "End of List",
        description: "All beneficiaries in this list have been reviewed.",
      });
      setSelectedBeneficiary(null);
    }
  }, [filteredBeneficiaries, selectedBeneficiary, form, toast]);

  const handleFormSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!selectedBeneficiary) return;
    setLoading((p) => ({ ...p, saving: true }));

    const cycle = config.followUpCycle;
    let payload: any = { id: selectedBeneficiary.id };

    payload[`bnf_attend_c${cycle}`] = data.bnf_attend_c;

    if (data.bnf_attend_c === "لا") {
      payload[`not_attend_reason_c${cycle}`] = data.not_attend_reason_c;
    } else {
      payload[`date_attend_c${cycle}`] = `${data.date_attend_c_year}-${data.date_attend_c_month}-${data.date_attend_c_day}`;
      payload[`bnf_isprev_ref_c${cycle}`] = data.bnf_isprev_ref_c;

      if (data.bnf_isprev_ref_c === "لا") {
        payload[`hc_muac_c${cycle}`] = data.hc_muac_c_no;
        payload[`cmam_result_c${cycle}`] = data.cmam_result_c_no;
      } else {
        payload[`hc_muac_c${cycle}`] = data.hc_muac_c;
        payload[`cmam_result_c${cycle}`] = data.cmam_result_c;
      }
    }

    payload = runCycleCalculations(payload, selectedBeneficiary, cycle);

    try {
      await fetch("/api/bnf-cmam", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([payload]),
      });
      toast({ title: "Success", description: "Beneficiary record updated successfully." });
      moveToNextBeneficiary();
    } catch (err: any) {
      toast({ title: "Error updating", description: err.message, variant: "destructive" });
    } finally {
      setLoading((p) => ({ ...p, saving: false }));
    }
  };

  const filteredBeneficiariesByHC = useMemo(() => {
    if (!selectedHealthCenterId) return [];
    return beneficiaries.filter((b) => b.hc_id === selectedHealthCenterId);
  }, [beneficiaries, selectedHealthCenterId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            إدخال بيانات إحالة المستفيدات
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="hover:bg-slate-100" asChild>
            <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/referral/cycles">
              <ArrowLeft className="mr-2 h-4 w-4" /> العودة
            </Link>
          </Button>
          <Button variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20" asChild>
            <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/preparing/database">
              <Database className="mr-2 h-4 w-4" />
              Beneficiaries CMAM Database
            </Link>
          </Button>
          <Button variant="default" className="shadow-md" asChild>
            <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/referral/export">
              <FileText className="mr-2 h-4 w-4" />
              Exporting Beneficiaries Referral Statements
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-t-4 border-t-primary shadow-md">
        <CardHeader className="bg-slate-50/50 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="w-5 h-5 text-slate-500" /> إعدادات المشـروع و دورة المتابعة
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 items-end">
          <div className="space-y-2">
            <Label className="font-semibold text-white">اختر المشروع</Label>
            <Select onValueChange={(v) => handleProjectSelect(v)} value={config.projectId}>
              <SelectTrigger className="border-slate-300 focus:ring-primary">
                <SelectValue placeholder="بحث واختيار المشروع..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.projectId} value={p.projectId}>
                    {p.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="font-semibold text-white">دورة المتابعة</Label>
            <Input
              value={`دورة المتابعة: ${config.followUpCycle}`}
              readOnly
              className="bg-slate-50 border-slate-200 text-slate-600 cursor-not-allowed"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold text-white">شهر المتابعة</Label>
            <Input
              value={`شهر المتابعة: ${config.followUpMonth}`}
              readOnly
              className="bg-slate-50 border-slate-200 text-slate-600 cursor-not-allowed"
            />
          </div>
        </CardContent>
      </Card>

      {config.projectId && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-5 border border-slate-200 shadow-md h-fit">
            <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-slate-500" /> اختيار المستفيدة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label className="font-semibold text-white">اختـر المركز الصحي</Label>
                <Select
                  value={selectedHealthCenterId}
                  onValueChange={(v) => {
                    setSelectedHealthCenterId(v);
                    setSelectedBeneficiary(null);
                  }}
                >
                  <SelectTrigger className="border-slate-300 focus:ring-primary">
                    <SelectValue placeholder="البحث واختيار المركز الصحي..." />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2 border-b">
                      <div className="relative">
                        <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="بحث..."
                          className="pr-8 h-9"
                          value={hcSearch}
                          onChange={(e) => setHcSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <ScrollArea className="h-[200px]">
                      {filteredHCs.map((hc) => (
                        <SelectItem key={hc.hc_id} value={hc.hc_id}>
                          {hc.hc_name}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>

              {selectedHealthCenterId && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="بحث برقم ID أو اسم المستفيدة..."
                      className="pr-9 border-slate-300 focus-visible:ring-primary"
                      value={beneficiarySearch}
                      onChange={(e) => setBeneficiarySearch(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-[450px] border border-slate-200 rounded-lg bg-white shadow-inner">
                    <Table>
                      <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <TableRow>
                          <TableHead className="w-[60px] text-center font-bold text-white">تحديد</TableHead>
                          <TableHead className="font-bold text-white">ID</TableHead>
                          <TableHead className="font-bold text-white">اسم المستفيدة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBeneficiaries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-slate-500 py-8">
                              لا توجد بيانات مطابقة
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredBeneficiaries.map((b) => (
                            <TableRow
                              key={b.id}
                              onClick={() => setSelectedBeneficiary(b)}
                              className={cn(
                                "cursor-pointer transition-colors hover:bg-slate-50",
                                selectedBeneficiary?.id === b.id &&
                                  "bg-primary/10 hover:bg-primary/15 border-l-4 border-primary"
                              )}
                            >
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={selectedBeneficiary?.id === b.id}
                                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                              </TableCell>
                              <TableCell className="font-medium text-slate-700">{b.BENEF_ID}</TableCell>
                              <TableCell className="text-slate-600">{b.BENEF_NAME}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>

          <Card
            className={cn(
              "lg:col-span-7 transition-opacity duration-300 border border-slate-200 shadow-lg",
              !selectedBeneficiary && "opacity-50 pointer-events-none"
            )}
          >
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)}>
                <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
                  <CardTitle className="text-xl flex justify-between items-center text-white">
                    <span>بيانات المتابعة</span>
                    {selectedBeneficiary && (
                      <span className="text-sm font-normal px-3 py-1 rounded-full shadow-sm border border-primary/20">
                        {selectedBeneficiary.BENEF_NAME}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 pt-8 px-8">
                  <FormField
                    control={form.control}
                    name="bnf_attend_c"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-base font-bold text-white">
                          هل امتثل المستفيدة إلى المركز الصحي؟
                        </FormLabel>
                        <FormControl>
                          <div className="flex gap-4">
                            <Button
                              type="button"
                              size="lg"
                              variant={field.value === "نعم" ? "default" : "outline"}
                              onClick={() => field.onChange("نعم")}
                              className={cn(
                                "flex-1 text-lg transition-all",
                                field.value === "نعم" && "shadow-md ring-2 ring-primary ring-offset-2"
                              )}
                            >
                              نعم
                            </Button>
                            <Button
                              type="button"
                              size="lg"
                              variant={field.value === "لا" ? "destructive" : "outline"}
                              onClick={() => field.onChange("لا")}
                              className={cn(
                                "flex-1 text-lg transition-all",
                                field.value === "لا" && "shadow-md ring-2 ring-destructive ring-offset-2"
                              )}
                            >
                              لا
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchAttend === "لا" && (
                    <div className="p-6 bg-red-50 rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-4">
                      <FormField
                        control={form.control}
                        name="not_attend_reason_c"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-red-800 font-semibold">سبب عدم الحضور</FormLabel>
                            <FormControl>
                              <Input {...field} className="bg-white text-black border-red-200 focus-visible:ring-red-400" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="mt-6 flex justify-end">
                        <Button type="submit" size="lg" disabled={!isFormValid || loading.saving} className="w-full md:w-auto px-8">
                          {loading.saving && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                          حفظ وتحديث الحالة
                        </Button>
                      </div>
                    </div>
                  )}

                  {watchAttend === "نعم" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-top-4">
                      <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                        <Label className="text-base font-bold text-slate-800">تاريخ امتثال الحالة</Label>
                        <div className="grid grid-cols-3 gap-3">
                          <FormField
                            control={form.control}
                            name="date_attend_c_day"
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="bg-white text-black">
                                      <SelectValue placeholder="يوم" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {days.map((d) => (
                                      <SelectItem key={d} value={String(d)}>
                                        {d}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="date_attend_c_month"
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="bg-white text-black">
                                      <SelectValue placeholder="شهر" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {months.map((m, i) => (
                                      <SelectItem key={m} value={String(i + 1)}>
                                        {m}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="date_attend_c_year"
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="bg-white text-black">
                                      <SelectValue placeholder="سنة" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {years.map((y) => (
                                      <SelectItem key={y} value={String(y)}>
                                        {y}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="bnf_isprev_ref_c"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel className="text-base font-bold text-white">
                              هل تعاملت المستفيدة من دورة سابقة؟
                            </FormLabel>
                            <FormControl>
                              <div className="flex gap-4">
                                <Button
                                  type="button"
                                  size="lg"
                                  variant={field.value === "نعم" ? "default" : "outline"}
                                  onClick={() => field.onChange("نعم")}
                                  className={cn(
                                    "flex-1 text-lg transition-all",
                                    field.value === "نعم" && "shadow-md"
                                  )}
                                >
                                  نعم
                                </Button>
                                <Button
                                  type="button"
                                  size="lg"
                                  variant={field.value === "لا" ? "destructive" : "outline"}
                                  onClick={() => field.onChange("لا")}
                                  className={cn(
                                    "flex-1 text-lg transition-all",
                                    field.value === "لا" && "shadow-md"
                                  )}
                                >
                                  لا
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {watchAttend === "نعم" && watchHasMalnutrition === "لا" && (
                    <div className="p-6 bg-green-50 rounded-xl border border-green-100 space-y-6 animate-in fade-in zoom-in-95">
                      <FormField
                        control={form.control}
                        name="hc_muac_c_no"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex justify-between items-center mb-4">
                              <FormLabel className="text-green-900 font-bold text-lg">قياس المواءك</FormLabel>
                              <span className="text-2xl font-black text-green-700 bg-green-200 px-3 py-1 rounded-lg">
                                {field.value || 23}
                              </span>
                            </div>
                            <FormControl>
                              <Slider
                                dir="ltr"
                                min={23}
                                max={30}
                                step={0.1}
                                value={[field.value || 23]}
                                onValueChange={(v) => field.onChange(v[0])}
                                className="py-4"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="cmam_result_c_no"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-green-900 font-bold">نتيجة المتابعة</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-white text-black border-green-200 focus:ring-green-500">
                                  <SelectValue placeholder="اختر النتيجة..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {["شفاء", "تخلف", "الوفاة", "عدم استجابة", "إنتهاء فترة الدعم / تخرج من برنامج سوء التغذية"].map((r) => (
                                  <SelectItem key={r} value={r}>
                                    {r}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="pt-4 flex justify-end">
                        <Button type="submit" size="lg" className="w-full md:w-auto px-8 bg-green-600 hover:bg-green-700" disabled={!isFormValid || loading.saving}>
                          {loading.saving && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                          حفظ التحديثات وانتهاء
                        </Button>
                      </div>
                    </div>
                  )}

                  {watchAttend === "نعم" && watchHasMalnutrition === "نعم" && (
                    <div className="p-6 bg-amber-50 rounded-xl border border-amber-100 space-y-6 animate-in fade-in zoom-in-95">
                      <FormField
                        control={form.control}
                        name="hc_muac_c"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex justify-between items-center mb-4">
                              <FormLabel className="text-amber-900 font-bold text-lg">قياس المواءك</FormLabel>
                              <span className="text-2xl font-black text-amber-700 bg-amber-200 px-3 py-1 rounded-lg">
                                {field.value || 17}
                              </span>
                            </div>
                            <FormControl>
                              <Slider
                                dir="ltr"
                                min={17}
                                max={26}
                                step={0.1}
                                value={[field.value || 17]}
                                onValueChange={(v) => field.onChange(v[0])}
                                className="py-4"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="cmam_result_c"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-amber-900 font-bold">حالة المتابعة</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-white text-black border-amber-200 focus:ring-amber-500">
                                  <SelectValue placeholder="اختر النتيجة..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <div className="grid grid-cols-1 gap-1">
                                  {[
                                    "مستمر بالمعالجة",
                                    "شفاء",
                                    "تخلف",
                                    "الوفاة",
                                    "عدم استجابة",
                                    "إنتهاء فترة الدعم / تخرج من برنامج سوء التغذية",
                                  ].map((r) => (
                                    <SelectItem key={r} value={r} className="cursor-pointer hover:bg-amber-100">
                                      {r}
                                    </SelectItem>
                                  ))}
                                </div>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="pt-4 flex justify-end">
                        <Button type="submit" size="lg" className="w-full md:w-auto px-8 bg-amber-600 hover:bg-amber-700" disabled={!isFormValid || loading.saving}>
                          {loading.saving && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                          حفظ التحديثات والانتقال
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </form>
            </Form>
          </Card>
        </div>
      )}
    </div>
  );
}