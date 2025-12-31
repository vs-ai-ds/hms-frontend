// src/app/lib/api/appointments.ts
import { apiClient } from "@app/lib/apiClient";
import type { Appointment } from "../../../types/appointment";

export interface AppointmentFilters {
  search?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  date?: string; // Special: "today" for today's date
  visit_type?: string; // "OPD" or "IPD"
  doctor_user_id?: string;
  doctor_id?: string; // Alias for doctor_user_id
  department_id?: string;
  page?: number;
  page_size?: number;
}

export async function fetchAppointments(filters?: AppointmentFilters): Promise<{ items: Appointment[]; total: number; page: number; page_size: number }> {
  const params: any = {};
  if (filters?.search) params.search = filters.search;
  if (filters?.status) params.status = filters.status;
  if (filters?.date_from) params.date_from = filters.date_from;
  if (filters?.date_to) params.date_to = filters.date_to;
  if (filters?.date === "today") {
    const today = new Date().toISOString().split("T")[0];
    params.date_from = today;
    params.date_to = today;
  }
  if (filters?.visit_type) params.visit_type = filters.visit_type;
  if (filters?.doctor_user_id) params.doctor_user_id = filters.doctor_user_id;
  if (filters?.doctor_id) params.doctor_user_id = filters.doctor_id; // Support alias
  if (filters?.department_id) params.department_id = filters.department_id;
  if (filters?.page) params.page = filters.page;
  if (filters?.page_size) params.page_size = filters.page_size;
  
  const res = await apiClient.get("/appointments", { params });
  return res.data;
}

export async function getAppointment(id: string): Promise<Appointment> {
  const res = await apiClient.get(`/appointments/${id}`);
  return res.data;
}

export async function createAppointment(payload: any) {
  const res = await apiClient.post("/appointments", payload);
  return res.data;
}

export async function updateAppointmentStatus(id: string, status: string) {
  const res = await apiClient.patch(`/appointments/${id}`, { status });
  return res.data;
}

export async function checkInAppointment(id: string) {
  const res = await apiClient.patch(`/appointments/${id}/check-in`, {});
  return res.data;
}

export async function startConsultation(id: string) {
  const res = await apiClient.patch(`/appointments/${id}/start-consultation`, {});
  return res.data;
}

export async function completeAppointment(id: string, withRx: boolean = false, closureNote?: string) {
  const res = await apiClient.patch(`/appointments/${id}/complete`, {
    with_rx: withRx,
    closure_note: closureNote,
  });
  return res.data;
}

export async function cancelAppointment(id: string, reason: string, note?: string) {
  const res = await apiClient.patch(`/appointments/${id}/cancel`, {
    reason,
    note,
  });
  return res.data;
}

export async function markNoShow(id: string) {
  const res = await apiClient.patch(`/appointments/${id}/no-show`, {});
  return res.data;
}

export async function rescheduleAppointment(id: string, scheduledAt: string) {
  const res = await apiClient.patch(`/appointments/${id}/reschedule`, {
    scheduled_at: scheduledAt,
  });
  return res.data;
}