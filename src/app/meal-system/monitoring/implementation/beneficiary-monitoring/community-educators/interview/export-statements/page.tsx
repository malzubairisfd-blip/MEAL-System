"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Download } from "lucide-react";

type Project = { projectId: string; projectName: string };
type Hall = { hallName: string; hallNumber: number };
type Applicant = { applicant_id: number; applicant_name: string; [key: string]: any };

export default function ExportStatementsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [hallCount, setHallCount] = useState(1);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [accepted, setAccepted] = useState<Applicant[]>([]);
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
      setAccepted([]);
      return;
    }
    setLoading(prev => ({...prev, applicants: true}));
    fetch(`/api/ed-selection`)
      .then(r => r.json())
      .then(data => {
        if(Array.isArray(data)){
          const projectApplicants = data.filter(r => r.project_id === projectId && r.acceptance_results === 'مقبولة');
          setAccepted(projectApplicants);
        } else {
          setAccepted([]);
        }
      })
      .catch(err => toast({ title: "Failed to load applicants", variant: 'destructive'}))
      .finally(() => setLoading(prev => ({...prev, applicants: false})));
  }, [projectId, toast]);

  const generateHalls = () => {
    setHalls(
      Array.from({ length: hallCount }, (_, i) => ({
        hallName: `قاعة ${i + 1}`,
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
      const res = await fetch("/api/interviews/link", {
        method: "POST",
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          projectId,
          hallNumber: selectedHall,
          hallName: hall?.hallName || `Hall ${selectedHall}`,
          applicantIds: selectedApplicants,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to link applicants.");
      }

      toast({ title: "تم الربط بنجاح", description: `تم ربط ${selectedApplicants.length} متقدم بالقاعة ${hall?.hallName}`});
      setSelectedApplicants([]); // Clear selection after linking
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
      <h1 className="text-3xl font-bold">توليد كشوفات المقابلات</h1>

      <Card>
        <CardHeader>
          <CardTitle>1. إعداد المشروع والقاعات</CardTitle>
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
            <Button onClick={generateHalls}>إنشاء القاعات</Button>
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
            <CardTitle>2. ربط المتقدمين بالقاعات</CardTitle>
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
                    {accepted.map(a => (
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
                <SelectTrigger className="flex-1"><SelectValue placeholder="اختر القاعة لربط المتقدمين" /></SelectTrigger>
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
                ربط {selectedApplicants.length} متقدمين بالقاعة
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {projectId && (
        <Card>
           <CardHeader>
            <CardTitle>3. تصدير الكشوفات</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
                <a href={`/api/interviews/export?projectId=${projectId}`}>
                  <Download className="mr-2 h-4 w-4"/>
                  تصدير ملف PDF لجميع القاعات
                </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
