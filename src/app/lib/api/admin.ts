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

export async function refreshDemoData(payload: DemoRefreshRequest): Promise<DemoRefreshResponse> {
  const res = await apiClient.post<DemoRefreshResponse>("/admin/demo/refresh", payload);
  return res.data;
}

