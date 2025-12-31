// src/app/lib/validation/prescriptionValidation.ts
import { z } from "zod";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const optionalUuid = z
  .string()
  .optional()
  .nullable()
  .refine((val) => {
    if (!val || val === "") return true;
    return uuidRegex.test(val);
  }, "Must be a valid UUID");

export const prescriptionMedicineSchema = z
  .object({
    stock_item_id: optionalUuid,
    name: z.string().trim().min(1, "Medicine name is required"),
    dosage: z.string().trim().min(1, "Dosage is required"),
    frequency: z.string().trim().min(1, "Frequency is required"),
    duration: z.string().trim().min(1, "Duration is required"),
    instructions: z.string().trim().optional(),
    quantity: z
      .preprocess((val) => {
        // react-hook-form valueAsNumber can yield NaN
        if (val === "" || val === null || val === undefined) return null;
        if (typeof val === "number" && Number.isNaN(val)) return null;
        return val;
      }, z.number().int().positive().nullable().optional()),
  })
  .superRefine((data, ctx) => {
    // Quantity is required for all medicines (both stock and non-stock items)
    if (!data.quantity || data.quantity <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Quantity is required and must be a positive number",
        path: ["quantity"],
      });
    }
  });

export const prescriptionSchema = z
  .object({
    patient_id: z.string().trim().min(1, "Patient is required"),

    appointment_id: z
      .string()
      .optional()
      .nullable()
      .refine((val) => {
        if (!val || val === "") return true;
        if (val === "WALK_IN") return true;
        return uuidRegex.test(val);
      }, "Appointment ID must be a valid UUID or 'WALK_IN'"),

    admission_id: optionalUuid,

    chief_complaint: z
      .string()
      .trim()
      .min(5, "Chief complaint must be at least 5 characters")
      .refine((val) => val.replace(/\s+/g, " ").trim().length >= 5, {
        message: "Chief complaint must be at least 5 characters (multiple spaces are not allowed)",
      }),

    diagnosis: z
      .string()
      .trim()
      .min(5, "Diagnosis must be at least 5 characters")
      .refine((val) => val.replace(/\s+/g, " ").trim().length >= 5, {
        message: "Diagnosis must be at least 5 characters (multiple spaces are not allowed)",
      }),

    no_medicines: z.boolean().optional(),
    no_medicines_note: z.string().optional(),

    medicines: z.array(prescriptionMedicineSchema).optional(),
  })
  .superRefine((data, ctx) => {
    // Must have either appointment_id OR admission_id (not both)
    const hasAppointment = !!data.appointment_id;
    const hasAdmission = !!data.admission_id;

    if (!hasAppointment && !hasAdmission) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select an appointment or choose 'Walk-in OPD' option",
        path: ["appointment_id"],
      });
    }
    if (hasAppointment && hasAdmission) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose either appointment (OPD) or admission (IPD), not both",
        path: ["appointment_id"],
      });
    }

    // Medicines OR No-medicines with note
    if (data.no_medicines) {
      if (!data.no_medicines_note || data.no_medicines_note.trim().length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please provide a note (min 5 chars) when no medicines are prescribed",
          path: ["no_medicines_note"],
        });
      }
      return;
    }

    if (!data.medicines || data.medicines.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least one medicine or check 'No medicines prescribed'",
        path: ["medicines"],
      });
    }
  });

export type PrescriptionFormValues = z.infer<typeof prescriptionSchema>;
export type PrescriptionMedicineFormValues = z.infer<typeof prescriptionMedicineSchema>;