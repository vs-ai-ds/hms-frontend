// src/types/prescription.ts

export type PrescriptionStatus = "DRAFT" | "ISSUED" | "DISPENSED" | "CANCELLED";

export interface PrescriptionMedicine {
  id: string;
  name: string;
  dosage: string;           // "500 mg"
  frequency: string;        // "1-0-1"
  duration: string;         // "5 days"
  instructions?: string | null;
}

export interface Prescription {
  id: string;
  patient_id: string;
  patient_name: string;
  doctor_name: string | null;

  visit_type: "OPD" | "IPD";
  diagnosis: string | null;

  medicines: PrescriptionMedicine[];

  status: PrescriptionStatus;

  created_at: string;
}