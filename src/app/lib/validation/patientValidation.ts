// src/app/lib/validation/patientValidation.ts
import { z } from "zod";

const phoneRegex = /^[0-9+\-\s]{5,15}$/;

export const patientSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, "First name is required"),
  last_name: z
    .string()
    .trim()
    .optional(),
  phone: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || phoneRegex.test(val),
      {
        message:
          "Phone must be 10–15 characters and contain only digits, spaces, + or -",
      }
    ),
  email: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) =>
        !val ||
        val.length === 0 ||
        z
          .string()
          .email()
          .safeParse(val).success,
      {
        message: "Enter a valid email address",
      }
    ),
  department: z.string().trim().min(1, "Department is required"),
  patient_type: z.enum(["OPD", "IPD"]),
});

export type PatientFormValues = z.infer<typeof patientSchema>;