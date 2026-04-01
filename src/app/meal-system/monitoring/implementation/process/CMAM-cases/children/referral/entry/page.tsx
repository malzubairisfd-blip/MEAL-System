"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, Database, FileText, Building2, Users, Baby, Activity, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface Project { projectId: string; projectName: string; }
interface HealthCenter { hc_id: string; hc_name: string; }
interface Beneficiary { benef_id: string; bnf_name: string; hc_id: string; [key: string]: any; }
interface Child {
  id: number;
  child_id: string;
  child_name: string;
  benef_id: string;
  hc_id: string;
  hc_name?: string;
  bnf_name?: string;
  child_has_cmam_hc?: string;
  next_cycle_c1?: string;
  next_cycle_c2?: string;
  next_cycle_c3?: string;
  meas_type?: string;
  muac_hc?: number;
  muac_c1?: number;
  muac_c2?: number;
  zscore_hc?: number;
  zscore_c1?: number;
  zscore_c2?: number;
  child_age_c1?: number;
  child_age_c2?: number;
  child_age_c3?: number;
  [key: string]: any;
}
interface ReferralCycleConfig {
  projectId: string;
  followUpCycle: number;
  followUpMonth: string;
}

const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","دسمبر"];
const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
const days = Array.from({ length: 31 }, (_, i) => i + 1);

const formSchema = z.object({
  child_attend: z.enum(["نعم","لا"]),
  not_attend_reason: z.string().optional(),
  attend_date: z.string().optional(),
  child_has_cmam: z.enum(["نعم","لا"]).optional(),
  muac: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  zscore: z.string().optional(),
  child_status: z.enum(["سوء تغذية متوسط","سوء تغذية حاد"]).optional(),
  followup_status: z.string().optional(),
  cmam_result: z.string().optional(),
});

export default function ChildReferralDataEntryPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [config, setConfig] = useState<ReferralCycleConfig>({ projectId: "", followUpCycle: 1, followUpMonth: "" });
  const [healthCenters, setHealthCenters] = useState<HealthCenter[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [allChildren, setAllChildren] = useState<Child[]>([]);
  const [selectedHealthCenterId, setSelectedHealthCenterId] = useState("");
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [beneficiarySearch, setBeneficiarySearch] = useState("");
  const [childSearch, setChildSearch] = useState("");
  const [loading, setLoading] = useState({ projects: true, configs: true, data: false, saving: false });
  const [formData, setFormData] = useState({
    attended: "",
    notAttendReason: "",
    attendDate: "",
    hasMalnutrition: "",
    muac: "",
    height: "",
    weight: "",
    zscore: "",
    childStatus: "",
    followupStatus: "",
    cmamResult: ""
  });

  const form = useForm({ resolver: zodResolver(formSchema), mode: "onChange" });
  const watchChildAttend = formData.attended;
  const watchChildHasCmam = formData.hasMalnutrition;
  const watchMeasType = allChildren.find(c => c.child_id === selectedChildId)?.meas_type;
  const cycle = config.followUpCycle || 1;
  const cycleSuffix = `c${cycle}`;

  const fieldErrors = useMemo(() => {
    const errors: Record<string,string> = {};
    if (!config.projectId) errors.project = "اختر المشروع أولاً.";
    if (!selectedHealthCenterId) errors.healthCenter = "يرجى اختيار المركز الصحي.";
    if (!selectedBeneficiaryId) errors.beneficiary = "يرجى اختيار المستفيدة.";
    if (!selectedChildId) errors.child = "يرجى اختيار الطفل.";
    if (selectedChildId) {
      if (!formData.attended) errors.attended = "يرجى تحديد حالة الحضور.";
      if (formData.attended === "لا" && !formData.notAttendReason) errors.notAttendReason = "يرجى إدخال سبب عدم الحضور.";
      if (formData.attended === "نعم") {
        if (!formData.attendDate) errors.attendDate = "يرجى تحديد التاريخ.";
        if (!formData.hasMalnutrition) errors.hasMalnutrition = "هل يعاني من سوء تغذية؟";
        if (formData.hasMalnutrition === "لا" && (!formData.muac || !formData.cmamResult)) {
          if (!formData.muac) errors.muac = "الرجاء تحديد قياس المواك.";
          if (!formData.cmamResult) errors.cmamResult = "اختر نتيجة المتابعة.";
        }
        if (formData.hasMalnutrition === "نعم") {
          if (watchMeasType === "المواك" && !formData.muac) errors.muac = "الرجاء تحديد قياس المواك.";
          if (watchMeasType === "الزد اسكور") {
            if (!formData.height) errors.height = "الرجاء تحديد قياس الطول.";
            if (!formData.weight) errors.weight = "الرجاء تحديد قياس الوزن.";
            if (!formData.zscore) errors.zscore = "الرجاء اختيار الزد اسكور.";
          }
          if (!formData.childStatus) errors.childStatus = "الرجاء تحديد حالة الطفل.";
          if (!formData.followupStatus) errors.followupStatus = "الرجاء تحديد حالة المتابعة.";
        }
      }
    }
    return errors;
  }, [config.projectId, selectedHealthCenterId, selectedBeneficiaryId, selectedChildId, formData, watchMeasType]);

  const isQualified = (item: Child | Beneficiary) => {
    if (cycle === 1) return item.child_has_cmam_hc === "نعم" && ["Qualified","Last Month Qualification"].includes(item.next_cycle_c1 || "");
    if (cycle === 2) return ["Qualified","Last Month Qualification"].includes(item.next_cycle_c2 || "");
    return ["Qualified","Last Month Qualification"].includes(item.next_cycle_c3 || "");
  };

  const eligibleChildren = useMemo(() => allChildren.filter(isQualified), [allChildren, cycle]);
  const healthCenterOptions = useMemo(() => {
    const map = new Map<string, HealthCenter>();
    eligibleChildren.forEach(child => {
      if (child.hc_id && !map.has(child.hc_id)) {
        map.set(child.hc_id, { hc_id: child.hc_id, hc_name: child.hc_name || child.hc_id });
      }
    });
    return Array.from(map.values());
  }, [eligibleChildren]);
  const filteredHcs = useMemo(() => healthCenterOptions.filter(hc => !fieldErrors.healthCenter ? true : hc.hc_name.toLowerCase().includes(fieldErrors.healthCenter.toLowerCase())), [healthCenterOptions, fieldErrors.healthCenter]);

  const filteredBeneficiaries = useMemo(() => {
    if (!selectedHealthCenterId) return [];
    return eligibleChildren
      .filter(child => child.hc_id === selectedHealthCenterId)
      .filter((child, idx, arr) => arr.findIndex(c => c.benef_id === child.benef_id) === idx)
      .filter(child => beneficiarySearch ? child.bnf_name.toLowerCase().includes(beneficiarySearch.toLowerCase()) || child.benef_id.toLowerCase().includes(beneficiarySearch.toLowerCase()) : true);
  }, [eligibleChildren, selectedHealthCenterId, beneficiarySearch]);

  const filteredChildren = useMemo(() => {
    if (!selectedBeneficiaryId) return [];
    return eligibleChildren
      .filter(child => child.hc_id === selectedHealthCenterId && child.benef_id === selectedBeneficiaryId)
      .filter(child => childSearch ? child.child_name.toLowerCase().includes(childSearch.toLowerCase()) || child.child_id.toLowerCase().includes(childSearch.toLowerCase()) : true);
  }, [eligibleChildren, selectedHealthCenterId, selectedBeneficiaryId, childSearch]);

  const activeChild = useMemo(() => filteredChildren.find(child => child.child_id === selectedChildId) || null, [filteredChildren, selectedChildId]);

  const calculatePayload = (child: Child) => {
    const payload: Record<string, any> = { id: child.id };
    payload[`child_attend_${cycleSuffix}`] = formData.attended;
    if (formData.attended === "لا") {
      payload[`not_attend_reason_${cycleSuffix}`] = formData.notAttendReason;
      return payload;
    }
    payload[`date_attend_${cycleSuffix}`] = formData.attendDate;
    payload[`child_has_cmam_${cycleSuffix}`] = formData.hasMalnutrition;
    payload[`child_isprev_ref_${cycleSuffix}`] = child[`child_isprev_ref_${cycleSuffix}`] || "نعم";
    if (formData.hasMalnutrition === "لا") {
      payload[`muac_${cycleSuffix}`] = formData.muac;
      payload[`cmam_result_${cycleSuffix}`] = formData.cmamResult;
      return payload;
    }
    payload[`meas_type_${cycleSuffix}`] = child.meas_type;
    payload[`child_cmam_cond_${cycleSuffix}`] = formData.childStatus;
    if (child.meas_type === "المواك") payload[`muac_${cycleSuffix}`] = formData.muac;
    if (child.meas_type === "الزد اسكور") {
      payload[`zscore_h_${cycleSuffix}`] = formData.height;
      payload[`zscore_w_${cycleSuffix}`] = formData.weight;
      payload[`zscore_${cycleSuffix}`] = formData.zscore;
    }
    payload[`cmam_result_${cycleSuffix}`] = formData.followupStatus;
    const cureRate = determineCureRate(payload, child);
    determineNextCycle(payload, child, cureRate);
    return payload;
  };

  const determineCureRate = (payload: Record<string, any>, child: Child) => {
    const prevMuac = cycle === 1 ? child.muac_hc || 0 : cycle === 2 ? child.muac_c1 || 0 : child.muac_c2 || 0;
    const prevZ = cycle === 1 ? child.zscore_hc || 0 : cycle === 2 ? child.zscore_c1 || 0 : child.zscore_c2 || 0;
    const currentMuac = parseFloat(formData.muac || "0");
    const currentZ = parseFloat(formData.zscore || "0");
    let cureRate = "";
    if (child[`child_isprev_ref_${cycleSuffix}`] === "نعم") {
      const diffMuac = currentMuac - prevMuac;
      if (currentMuac && child.meas_type === "المواك") {
        cureRate = diffMuac < 0 ? "Negative" : diffMuac === 0 ? "No Improvement" : "Positive";
        payload[`positive_${cycleSuffix}`] = cureRate === "Positive" ? diffMuac : undefined;
        payload[`negative_${cycleSuffix}`] = cureRate === "Negative" ? diffMuac : undefined;
      }
      if (currentZ && child.meas_type === "الزد اسكور") {
        const diffZ = currentZ - prevZ;
        cureRate = diffZ < 0 ? "Negative" : diffZ === 0 ? "No Improvement" : "Positive";
        if (cureRate === "Positive") payload[`positive_${cycleSuffix}`] = Math.abs(diffZ);
        if (cureRate === "Negative") payload[`negative_${cycleSuffix}`] = diffZ;
      }
    }
    payload[`cure_rate_${cycleSuffix}`] = cureRate;
    return cureRate;
  };

  const determineNextCycle = (payload: Record<string, any>, child: Child, cureRate: string) => {
    const currentMuac = parseFloat(formData.muac || "0");
    const currentZ = parseFloat(formData.zscore || "0");
    if (currentMuac >= 12.5 || (child.meas_type === "الزد اسكور" && currentZ >= -1)) {
      payload[`next_cycle_${cycleSuffix}`] = "Disqualified";
      return;
    }
    const age = cycle === 1 ? child.child_age_c1 : cycle === 2 ? child.child_age_c2 : child.child_age_c3;
    if (age === 59) {
      payload[`next_cycle_${cycleSuffix}`] = "Last Month Qualification";
      return;
    }
    const status = formData.cmamResult || formData.followupStatus;
    if (["شفاء","الوفاة","انتهاء فترة الدعم / تخريج من برنامج سوء التغذية"].includes(status)) {
      payload[`next_cycle_${cycleSuffix}`] = cycle === 1 ? "Last Month Qualification" : "Disqualified";
      return;
    }
    if (["Negative","No Improvement"].includes(cureRate)) {
      payload[`next_cycle_${cycleSuffix}`] = cycle === 1 ? "Last Month Qualification" : "Disqualified";
      return;
    }
    payload[`next_cycle_${cycleSuffix}`] = "Qualified";
  };

  const handleProjectSelect = useCallback(async (projectId: string) => {
    setConfig(prev => ({ ...prev, projectId }));
    setSelectedHealthCenterId("");
    setSelectedBeneficiaryId(null);
    setSelectedChildId(null);
    if (!projectId) {
      setHealthCenters([]);
      setBeneficiaries([]);
      setAllChildren([]);
      return;
    }
    setLoading(p => ({ ...p, data: true }));
    try {
      const [childRes, bnfRes] = await Promise.all([
        fetch(`/api/child-cmam?projectId=${projectId}`).then(res => res.json()),
        fetch(`/api/bnf-cmam?projectId=${projectId}`).then(res => res.json()),
      ]);
      setAllChildren(childRes);
      setBeneficiaries(bnfRes);
      const uniqueHCs = Array.from(new Map(bnfRes.filter((bnf: any) => bnf.hc_id).map((bnf: any) => [bnf.hc_id, { hc_id: bnf.hc_id, hc_name: bnf.hc_name }])).values());
      setHealthCenters(uniqueHCs);
    } catch (error: any) {
      toast({ title: "Error loading data", description: error.message, variant: "destructive" });
    } finally {
      setLoading(p => ({ ...p, data: false }));
    }
  }, [toast]);

  useEffect(() => {
    setLoading(prev => ({ ...prev, projects: true, configs: true }));
    Promise.all([
      fetch("/api/projects").then(res => res.json()),
      fetch("/api/bnf-referral-cycle").then(res => res.json())
    ]).then(([projectData, configData]) => {
      setProjects(projectData || []);
      setConfig(configData || { projectId: "", followUpCycle: 1, followUpMonth: "" });
      if (configData?.projectId) handleProjectSelect(configData.projectId);
    }).catch(err => {
      toast({ title: "Error loading initial data", description: err.message, variant: "destructive" });
    }).finally(() => {
      setLoading(prev => ({ ...prev, projects: false, configs: false }));
    });
  }, [handleProjectSelect, toast]);

  const handleNextChild = () => {
    if (!selectedBeneficiaryId || !selectedChildId) return;
    const childIndex = filteredChildren.findIndex(child => child.child_id === selectedChildId);
    if (childIndex >= 0 && childIndex < filteredChildren.length - 1) {
      const nextChild = filteredChildren[childIndex + 1];
      setSelectedChildId(nextChild.child_id);
      setFormData({ attended: "", notAttendReason: "", attendDate: "", hasMalnutrition: "", muac: "", height: "", weight: "", zscore: "", childStatus: "", followupStatus: "", cmamResult: "" });
      toast({ description: `يتم الان الانتقال إلى الطفل: ${nextChild.child_name}` });
      return;
    }
    const bnfIndex = filteredBeneficiaries.findIndex(b => b.benef_id === selectedBeneficiaryId);
    if (bnfIndex >= 0 && bnfIndex < filteredBeneficiaries.length - 1) {
      const nextBnf = filteredBeneficiaries[bnfIndex + 1];
      setSelectedBeneficiaryId(nextBnf.benef_id);
      setSelectedChildId(null);
      setFormData({ attended: "", notAttendReason: "", attendDate: "", hasMalnutrition: "", muac: "", height: "", weight: "", zscore: "", childStatus: "", followupStatus: "", cmamResult: "" });
      toast({ description: `يتم الان الانتقال إلى المستفيدة: ${nextBnf.bnf_name}` });
    }
  };

  const handleUpdate = async () => {
    if (!selectedChildId) return;
    const child = allChildren.find(c => c.child_id === selectedChildId);
    if (!child) return;
    setLoading(p => ({ ...p, saving: true }));
    try {
      const payload = calculatePayload(child);
      await fetch("/api/child-cmam", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([payload]),
      });
      toast({ title: "نجاح", description: `تم تحديث بيانات الطفل ${child.child_name} بنجاح.` });
      handleNextChild();
    } catch {
      toast({ title: "خطأ", description: "فشل في تحديث البيانات", variant: "destructive" });
    } finally {
      setLoading(p => ({ ...p, saving: false }));
    }
  };

  const isFormReady = useMemo(() => {
    if (!selectedChildId) return false;
    if (!formData.attended) return false;
    if (formData.attended === "لا" && !formData.notAttendReason) return false;
    if (formData.attended === "نعم") {
      if (!formData.attendDate || !formData.hasMalnutrition) return false;
      if (formData.hasMalnutrition === "لا" && (!formData.muac || !formData.cmamResult)) return false;
      if (formData.hasMalnutrition === "نعم") {
        if (watchMeasType === "المواك" && !formData.muac) return false;
        if (watchMeasType === "الزد اسكور" && (!formData.height || !formData.weight || !formData.zscore)) return false;
        if (!formData.childStatus || !formData.followupStatus) return false;
      }
    }
    return true;
  }, [formData, selectedChildId, watchMeasType]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white border p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          <div>
            <p className="text-xl font-bold">إدخال بيانات إحالة الأطفال (سوء التغذية)</p>
            <p className="text-sm text-muted-foreground">تابع دورة المتابعة في نفس الصفحة</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/database">
              <Database className="mr-2 h-4 w-4" /> Children CMAM Database
            </Link>
          </Button>
          <Button variant="outline" onClick={() => toast({ title: "تصدير", description: "جارٍ تجهيز التصدير..." })}>
            <FileText className="mr-2 h-4 w-4" /> Exporting Children Referral Statements
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> 1. المشروع والدورة</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Select value={config.projectId} onValueChange={handleProjectSelect} disabled={loading.projects}>
              <SelectTrigger>
                <SelectValue placeholder={loading.projects ? "جاري التحميل..." : "اختر المشروع..."} />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}
              </SelectContent>
            </Select>
            {!config.projectId && <p className="text-xs text-red-500">يرجى اختيار المشروع أولاً.</p>}
          </div>
          <div className="space-y-1">
            <Label>دورة المتابعة</Label>
            <Input value={config.followUpCycle} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1">
            <Label>شهر المتابعة</Label>
            <Input value={config.followUpMonth || "غير محدد"} readOnly className="bg-muted" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> 2. اختر المركز</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Select value={selectedHealthCenterId} onValueChange={setSelectedHealthCenterId} disabled={!config.projectId || loading.data}>
              <SelectTrigger>
                <SelectValue placeholder={loading.data ? "جاري التحميل..." : "ابحث واختر المركز..."} />
              </SelectTrigger>
              <SelectContent>
                <ScrollArea className="h-60">
                  {healthCenterOptions.length === 0 ? (
                    <div className="p-2 text-sm text-center text-muted-foreground">لا توجد مراكز متاحة للدورة الحالية.</div>
                  ) : (
                    healthCenterOptions.map(hc => <SelectItem key={hc.hc_id} value={hc.hc_id}>{hc.hc_name}</SelectItem>)
                  )}
                </ScrollArea>
              </SelectContent>
            </Select>
            {fieldErrors.healthCenter && <p className="text-xs text-red-500">{fieldErrors.healthCenter}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> 3. اختيار المستفيدة</CardTitle></CardHeader>
          <CardContent>
            <Input placeholder="بحث..." value={beneficiarySearch} onChange={e => setBeneficiarySearch(e.target.value)} disabled={!selectedHealthCenterId} className="mb-2" />
            <ScrollArea className="h-60 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>تحديد</TableHead><TableHead>ID</TableHead><TableHead>الاسم</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBeneficiaries.map(b => (
                    <TableRow key={b.benef_id} onClick={() => { setSelectedBeneficiaryId(b.benef_id); setSelectedChildId(null); }} className="cursor-pointer">
                      <TableCell><Checkbox checked={selectedBeneficiaryId === b.benef_id} /></TableCell>
                      <TableCell>{b.benef_id}</TableCell>
                      <TableCell>{b.bnf_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            {fieldErrors.beneficiary && <p className="text-xs text-red-500 mt-1">{fieldErrors.beneficiary}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Baby className="h-5 w-5" /> 4. اختيار الطفل</CardTitle></CardHeader>
          <CardContent>
            <Input placeholder="بحث..." value={childSearch} onChange={e => setChildSearch(e.target.value)} disabled={!selectedBeneficiaryId} className="mb-2" />
            <ScrollArea className="h-60 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>تحديد</TableHead><TableHead>ID</TableHead><TableHead>الاسم</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChildren.map(c => (
                    <TableRow key={c.child_id} onClick={() => setSelectedChildId(c.child_id)} className="cursor-pointer">
                      <TableCell><Checkbox checked={selectedChildId === c.child_id} /></TableCell>
                      <TableCell>{c.child_id}</TableCell>
                      <TableCell>{c.child_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            {fieldErrors.child && <p className="text-xs text-red-500 mt-1">{fieldErrors.child}</p>}
          </CardContent>
        </Card>
      </div>

      {selectedChildId && activeChild && (
        <Card className="border-primary">
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> بيانات المتابعة الطبية</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-base">هل امتثل الطفل إلى المركز الصحي؟ <span className="text-red-500">*</span></Label>
              <RadioGroup value={formData.attended} onValueChange={v => setFormData(f => ({ ...f, attended: v }))} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="نعم" id="attend-yes" />
                  <Label htmlFor="attend-yes">نعم</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="لا" id="attend-no" />
                  <Label htmlFor="attend-no">لا</Label>
                </div>
              </RadioGroup>
              {fieldErrors.attended && <p className="text-xs text-red-500">{fieldErrors.attended}</p>}
            </div>
            {formData.attended === "لا" && (
              <div className="space-y-2">
                <Label>سبب عدم الحضور <span className="text-red-500">*</span></Label>
                <Input value={formData.notAttendReason} onChange={e => setFormData(f => ({ ...f, notAttendReason: e.target.value }))} />
                {fieldErrors.notAttendReason && <p className="text-xs text-red-500">{fieldErrors.notAttendReason}</p>}
              </div>
            )}
            {formData.attended === "نعم" && (
              <>
                <div className="space-y-2">
                  <Label>تاريخ امتثال الحالة <span className="text-red-500">*</span></Label>
                  <Input type="date" value={formData.attendDate} onChange={e => setFormData(f => ({ ...f, attendDate: e.target.value }))} />
                  {fieldErrors.attendDate && <p className="text-xs text-red-500">{fieldErrors.attendDate}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-base">هل يعاني الطفل من سوء تغذية؟ <span className="text-red-500">*</span></Label>
                  <RadioGroup value={formData.hasMalnutrition} onValueChange={v => setFormData(f => ({ ...f, hasMalnutrition: v }))} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="نعم" id="mal-yes" />
                      <Label htmlFor="mal-yes">نعم</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="لا" id="mal-no" />
                      <Label htmlFor="mal-no">لا</Label>
                    </div>
                  </RadioGroup>
                  {fieldErrors.hasMalnutrition && <p className="text-xs text-red-500">{fieldErrors.hasMalnutrition}</p>}
                </div>
                {formData.hasMalnutrition === "لا" && (
                  <div className="grid grid-cols-2 gap-4 border p-4 rounded-md bg-muted/30">
                    <div className="space-y-2">
                      <Label>قياس المواك (12.5 - 20) <span className="text-red-500">*</span></Label>
                      <Input type="number" min="12.5" max="20" step="0.1" value={formData.muac} onChange={e => setFormData(f => ({ ...f, muac: e.target.value }))} />
                      {fieldErrors.muac && <p className="text-xs text-red-500">{fieldErrors.muac}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>نتيجة المتابعة <span className="text-red-500">*</span></Label>
                      <Select value={formData.cmamResult} onValueChange={v => setFormData(f => ({ ...f, cmamResult: v }))}>
                        <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                        <SelectContent>
                          {["شفاء","تخلف","الوفاة","عدم استجابة","انتهاء فترة الدعم / تخريج من برنامج سوء التغذية"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {fieldErrors.cmamResult && <p className="text-xs text-red-500">{fieldErrors.cmamResult}</p>}
                    </div>
                  </div>
                )}
                {formData.hasMalnutrition === "نعم" && (
                  <div className="space-y-4 border p-4 rounded-md bg-muted/30">
                    {watchMeasType === "المواك" && (
                      <div className="space-y-2">
                        <Label>قياس المواك (7 - 12.49) <span className="text-red-500">*</span></Label>
                        <Input type="number" min="7" max="12.49" step="0.1" value={formData.muac} onChange={e => setFormData(f => ({ ...f, muac: e.target.value }))} />
                        {fieldErrors.muac && <p className="text-xs text-red-500">{fieldErrors.muac}</p>}
                      </div>
                    )}
                    {watchMeasType === "الزد اسكور" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>قياس الطول <span className="text-red-500">*</span></Label>
                          <Input type="number" value={formData.height} onChange={e => setFormData(f => ({ ...f, height: e.target.value }))} />
                          {fieldErrors.height && <p className="text-xs text-red-500">{fieldErrors.height}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>قياس الوزن <span className="text-red-500">*</span></Label>
                          <Input type="number" value={formData.weight} onChange={e => setFormData(f => ({ ...f, weight: e.target.value }))} />
                          {fieldErrors.weight && <p className="text-xs text-red-500">{fieldErrors.weight}</p>}
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label>قياس الزد اسكور <span className="text-red-500">*</span></Label>
                          <Select value={formData.zscore} onValueChange={v => setFormData(f => ({ ...f, zscore: v }))}>
                            <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                            <SelectContent>{[-3,-2,-1,0,1,2,3].map(o => <SelectItem key={o} value={o.toString()}>{o}</SelectItem>)}</SelectContent>
                          </Select>
                          {fieldErrors.zscore && <p className="text-xs text-red-500">{fieldErrors.zscore}</p>}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>حالة الطفل حالياً <span className="text-red-500">*</span></Label>
                        <RadioGroup value={formData.childStatus} onValueChange={v => setFormData(f => ({ ...f, childStatus: v }))} className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="سوء تغذية متوسط" id="status-1" />
                            <Label htmlFor="status-1">سوء تغذية متوسط</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="سوء تغذية حاد" id="status-2" />
                            <Label htmlFor="status-2">سوء تغذية حاد</Label>
                          </div>
                        </RadioGroup>
                        {fieldErrors.childStatus && <p className="text-xs text-red-500">{fieldErrors.childStatus}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>حالة المتابعة <span className="text-red-500">*</span></Label>
                        <Select value={formData.followupStatus} onValueChange={v => setFormData(f => ({ ...f, followupStatus: v }))}>
                          <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                          <SelectContent>
                            {["مستمر بالمعالجة","شفاء","تخلف","الوفاة","عدم استجابة","انتهاء فترة الدعم / تخريج من برنامج سوء التغذية"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {fieldErrors.followupStatus && <p className="text-xs text-red-500">{fieldErrors.followupStatus}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            {!isFormReady && selectedChildId && <p className="text-xs text-red-500 text-center">يرجى تعبئة كل الحقول الظاهرة حتى يتم تفعيل الزر.</p>}
            <Button className="w-full mt-4" size="lg" disabled={!isFormReady || loading.saving} onClick={handleUpdate}>
              {loading.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              تحديث السجل والانتقال للطفل التالي
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}