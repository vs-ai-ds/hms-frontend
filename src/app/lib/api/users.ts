import { apiClient } from "@app/lib/apiClient";

export async function fetchUsers(search?: string, includeInactive?: boolean): Promise<any[]> {
  const params: any = {};
  if (search) params.search = search;
  if (includeInactive) params.include_inactive = true;
  const res = await apiClient.get("/users", { params });
  return res.data;
}

export async function createUser(payload: any): Promise<any> {
  const res = await apiClient.post("/users", payload);
  return res.data;
}

export async function updateUser(userId: string, payload: any): Promise<any> {
  const res = await apiClient.patch(`/users/${userId}`, payload);
  return res.data;
}

export async function toggleUserActive(userId: string): Promise<any> {
  const res = await apiClient.patch(`/users/${userId}/toggle-active`);
  return res.data;
}

export async function deactivateUser(userId: string): Promise<any> {
  const res = await apiClient.post(`/users/${userId}/deactivate`);
  return res.data;
}

export async function getUser(userId: string): Promise<any> {
  const res = await apiClient.get(`/users/${userId}`);
  return res.data;
}

export async function resendInvitation(userId: string): Promise<any> {
  const res = await apiClient.post(`/users/${userId}/resend-invitation`);
  return res.data;
}

export async function forcePasswordChange(userId: string): Promise<any> {
  const res = await apiClient.post(`/users/${userId}/force-password-change`);
  return res.data;
}

export async function changePassword(oldPassword: string | null, newPassword: string): Promise<any> {
  const res = await apiClient.post("/auth/change-password", {
    old_password: oldPassword,
    new_password: newPassword,
  });
  return res.data;
}

