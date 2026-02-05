// src/hooks/use-itt-data.ts
import { useState, useEffect, useCallback } from 'react';
import { useToast as useToast_use_itt_data } from './use-toast';
import type { Logframe as Logframe_use_itt_data } from '@/lib/logframe';
import type { IndicatorTrackingPlan as IndicatorTrackingPlan_use_itt_data } from '@/types/monitoring-indicators';

interface Project_use_itt_data {
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
    const { toast } = useToast_use_itt_data();
    const [projects, setProjects] = useState<Project_use_itt_data[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [loading, setLoading] = useState({ projects: true, data: false });
    const [logframe, setLogframe] = useState<Logframe_use_itt_data | null>(null);
    const [indicatorPlan, setIndicatorPlan] = useState<IndicatorTrackingPlan_use_itt_data | null>(null);
    const [trackingData, setTrackingData] = useState<IndicatorTrackingPlan_use_itt_data | null>(null);

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


// src/hooks/use-mobile.tsx
"use client"

import * as React_use_mobile from "react"

const MOBILE_BREAKPOINT_use_mobile = 768

export function useIsMobile() {
  // Always return false to force desktop view
  return false
}


// src/hooks/use-toast.ts
"use client"

// Inspired by react-hot-toast library
import * as React_use_toast from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT_use_toast = 1
const TOAST_REMOVE_DELAY_use_toast = 1000000

type ToasterToast_use_toast = ToastProps & {
  id: string
  title?: React_use_toast.ReactNode
  description?: React_use_toast.ReactNode
  action?: ToastActionElement
}

const actionTypes_use_toast = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count_use_toast = 0

function genId_use_toast() {
  count_use_toast = (count_use_toast + 1) % Number.MAX_SAFE_INTEGER
  return count_use_toast.toString()
}

type ActionType_use_toast = typeof actionTypes_use_toast

type Action_use_toast =
  | {
      type: ActionType_use_toast["ADD_TOAST"]
      toast: ToasterToast_use_toast
    }
  | {
      type: ActionType_use_toast["UPDATE_TOAST"]
      toast: Partial<ToasterToast_use_toast>
    }
  | {
      type: ActionType_use_toast["DISMISS_TOAST"]
      toastId?: ToasterToast_use_toast["id"]
    }
  | {
      type: ActionType_use_toast["REMOVE_TOAST"]
      toastId?: ToasterToast_use_toast["id"]
    }

interface State_use_toast {
  toasts: ToasterToast_use_toast[]
}

const toastTimeouts_use_toast = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue_use_toast = (toastId: string) => {
  if (toastTimeouts_use_toast.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts_use_toast.delete(toastId)
    dispatch_use_toast({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY_use_toast)

  toastTimeouts_use_toast.set(toastId, timeout)
}

export const reducer_use_toast = (state: State_use_toast, action: Action_use_toast): State_use_toast => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT_use_toast),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue_use_toast(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue_use_toast(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners_use_toast: Array<(state: State_use_toast) => void> = []

let memoryState_use_toast: State_use_toast = { toasts: [] }

function dispatch_use_toast(action: Action_use_toast) {
  memoryState_use_toast = reducer_use_toast(memoryState_use_toast, action)
  listeners_use_toast.forEach((listener) => {
    listener(memoryState_use_toast)
  })
}

type Toast_use_toast = Omit<ToasterToast_use_toast, "id">

function toast_use_toast({ ...props }: Toast_use_toast) {
  const id = genId_use_toast()

  const update = (props: ToasterToast_use_toast) =>
    dispatch_use_toast({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch_use_toast({ type: "DISMISS_TOAST", toastId: id })

  dispatch_use_toast({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast_use_toast() {
  const [state, setState] = React_use_toast.useState<State_use_toast>(memoryState_use_toast)

  React_use_toast.useEffect(() => {
    listeners_use_toast.push(setState)
    return () => {
      const index = listeners_use_toast.indexOf(setState)
      if (index > -1) {
        listeners_use_toast.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast: toast_use_toast,
    dismiss: (toastId?: string) => dispatch_use_toast({ type: "DISMISS_TOAST", toastId }),
  }
}
