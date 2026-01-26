// src/app/store/taskStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ActiveTask {
  taskId: string | null;
  taskType: "DEMO_SEED" | "DEMO_FRESHEN" | "DEMO_RESET";
  action: "seed" | "freshen" | "reset";
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  progress: number;
  message: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface TaskState {
  activeTask: ActiveTask | null;
  setActiveTask: (task: ActiveTask | null) => void;
  updateTask: (updates: Partial<ActiveTask>) => void;
  clearTask: () => void;
  setTaskFromServer: (data: {
    task_id?: string;
    id?: string;
    task_type: string;
    status: string;
    progress: number;
    message?: string | null;
    error?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
  }) => void;
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set) => ({
      activeTask: null,

      setActiveTask: (task) =>
        set(() => ({
          activeTask: task,
        })),

      updateTask: (updates) =>
        set((state) => ({
          activeTask: state.activeTask
            ? { ...state.activeTask, ...updates }
            : null,
        })),

      clearTask: () =>
        set(() => ({
          activeTask: null,
        })),

      setTaskFromServer: (data) => {
        const taskId = data.task_id ?? data.id ?? null;
        const actionMap: Record<string, "seed" | "freshen" | "reset"> = {
          DEMO_SEED: "seed",
          DEMO_FRESHEN: "freshen",
          DEMO_RESET: "reset",
        };
        const taskType = data.task_type as "DEMO_SEED" | "DEMO_FRESHEN" | "DEMO_RESET";
        const action = actionMap[taskType] || "seed";

        set((state) => ({
          activeTask: state.activeTask
            ? {
                ...state.activeTask,
                taskId,
                taskType,
                action,
                status: data.status as ActiveTask["status"],
                progress: data.progress,
                message: data.message ?? null,
                error: data.error ?? null,
                started_at: data.started_at ?? null,
                completed_at: data.completed_at ?? null,
              }
            : {
                taskId,
                taskType,
                action,
                status: data.status as ActiveTask["status"],
                progress: data.progress,
                message: data.message ?? null,
                error: data.error ?? null,
                created_at: new Date().toISOString(),
                started_at: data.started_at ?? null,
                completed_at: data.completed_at ?? null,
              },
        }));
      },
    }),
    {
      name: "task-storage",
      // Only persist if task is not completed/failed (clean up on page reload)
      partialize: (state) => ({
        activeTask:
          state.activeTask &&
          (state.activeTask.status === "PENDING" || state.activeTask.status === "RUNNING")
            ? state.activeTask
            : null,
      }),
    }
  )
);
