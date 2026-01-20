"use client";

import { useEffect, useState, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, FileText } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Project = { projectId: string; projectName: string };
type Hall = { hallName: string; hallNumber: number };
type Applicant = { applicant_id: number; applicant_name: string; [key: string]: any };

function TrainingStatementsPageContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get('projectId');
  const [projectId, setProjectId] = useState(projectIdFromUrl || "");
  const [hallCount, setHallCount] = useState(1);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [qualifiedApplicants, setQualifiedApplicants] = useState<Applicant[]>([]);
  const [selectedApplicants, setSelectedApplicants] = useState<number[]>([]);
  const [selectedHall, setSelectedHall] = useState<number | null>(null);
  const [loading, setLoading] = useState({ projects: true, applicants: false });
  const [isLinking, setIsLinking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(prev => ({...prev, projects: true}));
    fetch("/api/projects")
      .then(r => r.json())
      .then(data => setProjects(Array.isArray(data) ? data : []))
      .catch(err => toast({ title: "Failed to load projects", variant: 'destructive'}))
      .finally(() => setLoading(prev => ({...prev, projects: false})));
  }, [toast]);

  useEffect(() => {
    if (!projectId) {
      setQualifiedApplicants([]);
      return;
    }
    setLoading(prev => ({...prev, applicants: true}));
    fetch(`/api/ed-selection`)
      .then(r => r.json())
      .then(data => {
        if(Array.isArray(data)){
          const projectApplicants = data.filter((r: any) => r.project_id === projectId && r.training_qualification === 'مؤهلة للتدريب' && r.training_hall_no == null);
          setQualifiedApplicants(projectApplicants);
        } else {
          setQualifiedApplicants([]);
        }
      })
      .catch(err => toast({ title: "Failed to load applicants", variant: 'destructive'}))
      .finally(() => setLoading(prev => ({...prev, applicants: false})));
  }, [projectId, toast]);

  const generateHalls = () => {
    setHalls(
      Array.from({ length: hallCount }, (_, i) => ({
        hallName: `قاعة تدريب ${i + 1}`,
        hallNumber: i + 1,
      }))
    );
  };

  const linkApplicants = async () => {
    if (!projectId || selectedHall === null || selectedApplicants.length === 0) {
        toast({ title: "Incomplete Selection", description: "Please select a project, a hall, and at least one applicant.", variant: "destructive" });
        return;
    }
    setIsLinking(true);
    try {
      const hall = halls.find(h => h.hallNumber === selectedHall);
      const res = await fetch("/api/trainings/link", {
        method: "POST",
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          projectId,
          hallNumber: selectedHall,
          hallName: hall?.hallName || `Training Hall ${selectedHall}`,
          applicantIds: selectedApplicants,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to link applicants.");
      }

      toast({ title: "تم الربط بنجاح", description: `تم ربط ${selectedApplicants.length} متدربين بالقاعة ${hall?.hallName}`});
      
      setQualifiedApplicants(prev => prev.filter(applicant => !selectedApplicants.includes(applicant.applicant_id)));
      setSelectedApplicants([]);

    } catch(err: any) {
        toast({ title: "Linking failed", description: err.message, variant: "destructive" });
    } finally {
        setIsLinking(false);
    }
  };

  const handleSelectApplicant = (applicantId: number, checked: boolean | 'indeterminate') => {
      if (typeof checked !== 'boolean') return;
      setSelectedApplicants(prev => checked ? [...prev, applicantId] : prev.filter(id => id !== applicantId));
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">توليد كشوفات التدريب</h1>

      <Card>
        <CardHeader>
          <CardTitle>1. إعداد المشروع وقاعات التدريب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select onValueChange={setProjectId} value={projectId} disabled={loading.projects}>
            <SelectTrigger><SelectValue placeholder={loading.projects ? "جاري تحميل المشاريع..." : "اختر المشروع"} /></SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-4">
            <Input
              type="number"
              min={1}
              value={hallCount}
              onChange={e => setHallCount(Math.max(1, +e.target.value))}
              className="w-24"
            />
            <Button onClick={generateHalls}>إنشاء قاعات التدريب</Button>
          </div>

          {halls.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {halls.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="اسم القاعة"
                    value={h.hallName}
                    onChange={e => {
                      const copy = [...halls];
                      copy[i].hallName = e.target.value;
                      setHalls(copy);
                    }}
                  />
                  <Input type="number" value={h.hallNumber} readOnly className="w-20 bg-muted"/>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {projectId && (
        <Card>
          <CardHeader>
            <CardTitle>2. ربط المتدربين بالقاعات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             {loading.applicants ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin"/></div> : (
              <ScrollArea className="h-72 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>الاسم</TableHead>
                      <TableHead>رقم المتقدم</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qualifiedApplicants.map(a => (
                      <TableRow key={a.applicant_id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedApplicants.includes(a.applicant_id)}
                            onCheckedChange={(checked) => handleSelectApplicant(a.applicant_id, checked)}
                          />
                        </TableCell>
                        <TableCell>{a.applicant_name}</TableCell>
                        <TableCell>{a.applicant_id}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
             )}
            <div className="flex items-center gap-4">
              <Select onValueChange={v => setSelectedHall(v ? +v : null)} disabled={halls.length === 0}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="اختر القاعة لربط المتدربين" /></SelectTrigger>
                <SelectContent>
                  {halls.map(h => (
                    <SelectItem key={h.hallNumber} value={String(h.hallNumber)}>
                      {h.hallName} (قاعة رقم {h.hallNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={linkApplicants} disabled={isLinking}>
                {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                ربط {selectedApplicants.length} متدربين بالقاعة
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {projectId && (
        <Card>
           <CardHeader>
            <CardTitle>3. تصدير كشوفات التدريب</CardTitle>
          </CardHeader>
          <CardContent>
             <Button asChild>
                <Link href={`/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/export-exact-pdf?projectId=${projectId}&type=training`}>
                    <FileText className="mr-2 h-4 w-4"/>
                    Go to PDF Designer
                </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


export default function TrainingPage() {
    return (
        <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <TrainingStatementsPageContent />
        </Suspense>
    )
}
