// src/hooks/use-itt-data.ts
import { useState, useEffect, useCallback } from 'use-sync-external-store/shim';
import { useToast } from './use-toast';
import type { Logframe } from '@/lib/logframe';
import type { IndicatorTrackingPlan } from '@/types/monitoring-indicators';

interface Project {
  projectId: string;
  projectName: string;
  governorates: string[];
  districts: string[];
  subDistricts: string[];
  startDateMonth: string;
  startDateYear:string;
  endDateMonth: string;
  endDateYear: string;
  beneficiaries: number;
}

export function useIttData() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [loading, setLoading] = useState({ projects: true, data: false });
    const [logframe, setLogframe] = useState<Logframe | null>(null);
    const [indicatorPlan, setIndicatorPlan] = useState<IndicatorTrackingPlan | null>(null);

    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(prev => ({ ...prev, projects: true }));
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to fetch projects");
                setProjects(await res.json());
            } catch (error: any) {
                toast({ title: "Error loading projects", description: error.message, variant: "destructive" });
            } finally {
                setLoading(prev => ({ ...prev, projects: false }));
            }
        };
        fetchProjects();
    }, [toast]);

    const selectProject = useCallback(async (projectId: string) => {
        setSelectedProjectId(projectId);
        if (!projectId) {
            setLogframe(null);
            setIndicatorPlan(null);
            return;
        }
        setLoading(prev => ({...prev, data: true }));
        try {
            const [logframeRes, indicatorPlanRes] = await Promise.all([
                fetch(`/api/logframe?projectId=${projectId}`),
                fetch(`/api/monitoring-indicators?projectId=${projectId}`)
            ]);

            if (!logframeRes.ok) {
                 toast({ title: "Logframe Not Found", description: "No logical framework found for this project. Please create one first.", variant: 'destructive'});
                 setLogframe(null);
            } else {
                setLogframe(await logframeRes.json());
            }
            
            if (!indicatorPlanRes.ok) {
                 toast({ title: "Indicator Plan Not Found", description: "No indicator plan found for this project. Please create one first.", variant: 'destructive'});
                 setIndicatorPlan(null);
            } else {
                 setIndicatorPlan(await indicatorPlanRes.json());
            }

        } catch (error: any) {
             toast({ title: "Error loading project data", description: error.message, variant: "destructive" });
        } finally {
            setLoading(prev => ({...prev, data: false }));
        }

    }, [toast]);

    return {
        projects,
        selectedProject: projects.find(p => p.projectId === selectedProjectId) || null,
        logframe,
        indicatorPlan,
        loading,
        selectProject,
    };
}
