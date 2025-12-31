// src/app/lib/validation/appointmentValidation.ts
import { z } from "zod";

/**
 * Validator for 15-minute interval times (00, 15, 30, 45)
 * Reusable across appointment-related schemas
 */
export const validate15MinuteInterval = (val: string): boolean => {
  try {
    // Handle datetime-local format (YYYY-MM-DDTHH:mm) or ISO format
    const date = new Date(val);
    if (isNaN(date.getTime())) {
      return false;
    }
    // Check if minutes are in 15-minute intervals (00, 15, 30, 45)
    const minutes = date.getMinutes();
    return minutes % 15 === 0;
  } catch {
    return false;
  }
};

// Base schema - department and doctor can be optional (will be set in backend for doctors)
// Note: Client-side validation in the form component enforces required fields for non-doctor users
export const appointmentSchema = z.object({
  patient_id: z.string().uuid("Patient is required"),
  department_id: z.string()
    .optional() // Optional - backend will set it for doctors, but form validation enforces it for non-doctors
    .refine(
      (val) => {
        // If provided, must be valid UUID
        if (!val || val.trim() === "") return true; // Empty is OK (backend will set it for doctors)
        try {
          z.string().uuid().parse(val);
          return true;
        } catch {
          return false;
        }
      },
      "Invalid department ID"
    ),
  doctor_user_id: z.string()
    .optional() // Optional - backend will set it for doctors, but form validation enforces it for non-doctors
    .refine(
      (val) => {
        // If provided, must be valid UUID
        if (!val || val.trim() === "") return true; // Empty is OK (backend will set it for doctors)
        try {
          z.string().uuid().parse(val);
          return true;
        } catch {
          return false;
        }
      },
      "Invalid doctor ID"
    ),
  scheduled_at: z.string()
    .refine(
      (val) => {
        try {
          // Handle datetime-local format (YYYY-MM-DDTHH:mm) or ISO format
          const date = new Date(val);
          if (isNaN(date.getTime())) {
            return false;
          }
          const now = new Date();
          // Allow today's date or future dates
          return date >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } catch {
          return false;
        }
      },
      "Appointment date cannot be in the past"
    )
    .refine(
      validate15MinuteInterval,
      "Please select a time in 15-minute steps (e.g., 08:00, 08:15, 08:30, 08:45)."
    ),
  notes: z.string().max(1000, "Notes must be at most 1000 characters").optional().nullable(),
});

export type AppointmentFormValues = z.infer<typeof appointmentSchema>;