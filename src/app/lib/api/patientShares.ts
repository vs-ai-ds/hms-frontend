import { apiClient } from "@app/lib/apiClient";

export interface TenantOption {
  id: string;
  name: string;
  contact_email: string;
}

export interface PatientShareCreate {
  target_tenant_id: string;
  share_mode: "READ_ONLY_LINK" | "CREATE_RECORD";
  validity_days: number;
  note?: string | undefined;
  consent_confirmed: boolean;
}

export interface PatientShareResponse {
  id: string;
  source_tenant_id: string;
  target_tenant_id?: string | null;
  patient_id: string;
  target_patient_id?: string | null; // Patient ID in target tenant (for CREATE_RECORD mode)
  share_mode: string;
  token: string;
  expires_at?: string | null;
  status: string;
  created_at: string;
  revoked_at?: string | null;
  note?: string | null;
  source_tenant_name?: string | null;
  target_tenant_name?: string | null;
  created_by_user_name?: string | null;
  patient_name?: string | null;
  patient_code?: string | null;
}

export async function fetchTenantsForSharing(search?: string): Promise<TenantOption[]> {
  const params: any = {};
  if (search) params.search = search;
  const res = await apiClient.get<TenantOption[]>("/patient-shares/tenants", { params });
  return res.data;
}

export async function createPatientShare(
  patientId: string,
  payload: PatientShareCreate
): Promise<PatientShareResponse> {
  const res = await apiClient.post<PatientShareResponse>(
    `/patient-shares?patient_id=${patientId}`,
    payload,
    { params: { patient_id: patientId } }
  );
  return res.data;
}

export async function listPatientShares(patientId?: string): Promise<PatientShareResponse[]> {
  const params: any = {};
  if (patientId) params.patient_id = patientId;
  const res = await apiClient.get<PatientShareResponse[]>("/patient-shares", { params });
  return res.data;
}

export async function revokePatientShare(shareId: string): Promise<PatientShareResponse> {
  const res = await apiClient.post<PatientShareResponse>(`/patient-shares/${shareId}/revoke`);
  return res.data;
}

export async function getSharedPatientByToken(token: string): Promise<any> {
  const res = await apiClient.get(`/patient-shares/shared/${token}`);
  return res.data;
}

export async function getSharedPatientData(shareId: string): Promise<any> {
  const res = await apiClient.get(`/patient-shares/${shareId}/patient-data`);
  return res.data;
}

export async function importPatientShare(shareId: string): Promise<PatientShareResponse> {
  const res = await apiClient.post<PatientShareResponse>(`/patient-shares/${shareId}/import`);
  return res.data;
}

