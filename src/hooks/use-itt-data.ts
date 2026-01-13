
// src/hooks/use-itt-data.ts
import { useState, useEffect, useCallback } from 'react';
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
    const [trackingData, setTrackingData] = useState<IndicatorTrackingPlan | null>(null);

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
            setTrackingData(null);
            return;
        }
        setLoading(prev => ({...prev, data: true }));
        try {
            const [logframeRes, indicatorPlanRes, trackingDataRes] = await Promise.all([
                fetch(`/api/logframe?projectId=${projectId}`),
                fetch(`/api/monitoring-indicators?projectId=${projectId}`),
                fetch(`/api/indicator-tracking?projectId=${projectId}`)
            ]);

            if (logframeRes.ok) {
                setLogframe(await logframeRes.json());
            } else {
                 setLogframe(null);
            }
            
            if (indicatorPlanRes.ok) {
                 setIndicatorPlan(await indicatorPlanRes.json());
            } else {
                toast({ title: "Indicator Plan Not Found", description: "No indicator plan found for this project. Please create one first.", variant: 'destructive'});
                setIndicatorPlan(null);
            }

            if(trackingDataRes.ok) {
                setTrackingData(await trackingDataRes.json());
            } else {
                setTrackingData(null);
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
        trackingData,
        loading,
        selectProject,
    };
}
