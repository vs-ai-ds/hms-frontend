import { apiClient } from "@app/lib/apiClient";

export interface DemoRefreshRequest {
  action: "seed" | "freshen" | "reset";
  freshen_days?: number;
}

export interface DemoRefreshResponse {
  status: string;
  action: string;
  freshen_days?: number | null;
  message: string;
}

export interface TaskStartResponse {
  task_id: string;
  status: string;
  message: string;
}

export interface TaskStatusResponse {
  id: string;
  user_id: string;
  task_type: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  progress: number;
  message: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// New async endpoint - starts task and returns immediately
export async function startDemoRefresh(payload: DemoRefreshRequest): Promise<TaskStartResponse> {
  const res = await apiClient.post<TaskStartResponse>("/admin/demo/refresh/start", payload);
  return res.data;
}

// Get task status
export async function getDemoRefreshStatus(taskId?: string): Promise<TaskStatusResponse> {
  const params = taskId ? { task_id: taskId } : {};
  const res = await apiClient.get<TaskStatusResponse>("/admin/demo/refresh/status", { params });
  return res.data;
}

// Legacy synchronous endpoint (deprecated but kept for backward compatibility)
export async function refreshDemoData(payload: DemoRefreshRequest): Promise<DemoRefreshResponse> {
  const res = await apiClient.post<DemoRefreshResponse>("/admin/demo/refresh", payload);
  return res.data;
}

