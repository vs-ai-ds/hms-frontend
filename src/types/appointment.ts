// src/types/appointment.ts
import type { PrescriptionStatus } from "./prescription";

// Export as const object for enum-like usage
export const AppointmentStatus = {
  SCHEDULED: "SCHEDULED",
  CHECKED_IN: "CHECKED_IN",
  IN_CONSULTATION: "IN_CONSULTATION",
  COMPLETED: "COMPLETED",
  NO_SHOW: "NO_SHOW",
  CANCELLED: "CANCELLED",
} as const;

// Export as type for type annotations
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string | null;
  patient_code: string | null;
  doctor_name: string | null;
  department: string | null;
  scheduled_at: string; // ISO string
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;

  // OPD Lifecycle fields
  checked_in_at: string | null;
  consultation_started_at: string | null;
  completed_at: string | null;
  no_show_at: string | null;
  cancelled_reason: string | null;
  cancelled_note: string | null;

  linked_ipd_admission_id: string | null;

  // Rx summary fields (from list endpoint)
  has_prescription: boolean;
  prescription_count?: number;
  prescription_status?: PrescriptionStatus | null;
}