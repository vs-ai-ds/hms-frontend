// src/app/lib/api/prescriptions.ts
import { apiClient } from "@app/lib/apiClient";

export interface Prescription {
  id: string;
  prescription_code?: string | null;

  patient_id: string;
  patient_name?: string;

  doctor_user_id: string;
  doctor_name?: string;

  appointment_id?: string | null;
  admission_id?: string | null;

  status: string;
  visit_type?: string;

  cancelled_at?: string | null;
  cancelled_reason?: string | null;

  chief_complaint?: string;
  diagnosis?: string;

  // Some endpoints may return medicines[], some items[] (normalize in UI)
  medicines?: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }>;

  items?: Array<{
    medicine_name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }>;

  created_at: string;
}

export interface PrescriptionFilters {
  patient_id?: string;
  appointment_id?: string;
  admission_id?: string;
  visit_type?: string;
  department_id?: string;
  doctor_user_id?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  order_by?: string;
  page?: number;
  page_size?: number;
}

export async function fetchPrescriptions(filters?: PrescriptionFilters): Promise<Prescription[]> {
  const params: any = {};
  if (filters?.patient_id) params.patient_id = filters.patient_id;
  if (filters?.appointment_id) params.appointment_id = filters.appointment_id;
  if (filters?.admission_id) params.admission_id = filters.admission_id;
  if (filters?.visit_type) params.visit_type = filters.visit_type;
  if (filters?.department_id) params.department_id = filters.department_id;
  if (filters?.doctor_user_id) params.doctor_user_id = filters.doctor_user_id;
  if (filters?.status) params.status = filters.status;
  if (filters?.date_from) params.date_from = filters.date_from;
  if (filters?.date_to) params.date_to = filters.date_to;
  if (filters?.order_by) params.order_by = filters.order_by;
  if (filters?.page) params.page = filters.page;
  if (filters?.page_size) params.page_size = filters.page_size;

  const res = await apiClient.get<Prescription[]>("/prescriptions", { params });
  return res.data;
}

export async function getPrescription(id: string): Promise<Prescription> {
  const res = await apiClient.get<Prescription>(`/prescriptions/${id}`);
  return res.data;
}

export async function createPrescription(payload: any): Promise<Prescription> {
  const res = await apiClient.post<Prescription>("/prescriptions", payload);
  return res.data;
}

export async function updatePrescriptionStatus(
  id: string,
  status: string,
  options?: {
    reason?: string;
    create_followup?: boolean;
    followup_scheduled_at?: string;
    followup_department_id?: string;
    followup_doctor_id?: string;
  }
): Promise<Prescription> {
  const payload: any = { status };
  if (options?.reason) payload.reason = options.reason;
  if (options?.create_followup) payload.create_followup = options.create_followup;
  if (options?.followup_scheduled_at) payload.followup_scheduled_at = options.followup_scheduled_at;
  if (options?.followup_department_id) payload.followup_department_id = options.followup_department_id;
  if (options?.followup_doctor_id) payload.followup_doctor_id = options.followup_doctor_id;

  const res = await apiClient.patch<Prescription>(`/prescriptions/${id}`, payload);
  return res.data;
}

export async function updatePrescription(id: string, payload: any): Promise<Prescription> {
  const res = await apiClient.put<Prescription>(`/prescriptions/${id}`, payload);
  return res.data;
}

export async function dispensePrescription(id: string): Promise<Prescription> {
  const res = await apiClient.patch<Prescription>(`/prescriptions/${id}/dispense`);
  return res.data;
}