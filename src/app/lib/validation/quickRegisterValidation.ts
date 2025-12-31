// src/app/lib/validation/quickRegisterValidation.ts
import { z } from "zod";

const normalizePhone = (phone: string): string => {
  return phone.replace(/[\s\-\(\)]/g, "");
};

const validatePhoneDigits = (phone: string): boolean => {
  const normalized = normalizePhone(phone);
  const digits = normalized.startsWith("+") ? normalized.slice(1) : normalized;
  const digitCount = digits.split("").filter((c) => /[0-9]/.test(c)).length;
  return digitCount >= 8 && digitCount <= 15;
};

export const quickRegisterSchema = z
  .object({
    first_name: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(50, "First name must be 1-50 characters")
      .regex(
        /^[a-zA-Z\u00C0-\u017F\s.'-]+$/,
        "First name can only contain letters, spaces, periods, apostrophes, and hyphens"
      ),
    last_name: z
      .string()
      .trim()
      .optional()
      .refine(
        (val) => !val || val.length <= 50,
        "Last name must be 1-50 characters if provided"
      )
      .refine(
        (val) => !val || /^[a-zA-Z\u00C0-\u017F\s.'-]+$/.test(val),
        "Last name can only contain letters, spaces, periods, apostrophes, and hyphens"
      ),
    dob: z.date().optional(),
    dob_unknown: z.boolean().default(false),
    age_only: z
      .number()
      .int()
      .min(0, "Age must be between 0 and 120")
      .max(120, "Age must be between 0 and 120")
      .optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"], {
      required_error: "Gender is required",
      invalid_type_error: "Gender must be one of: MALE, FEMALE, OTHER, UNKNOWN",
    }),
    // NOTE: patient_type removed - it's derived from active admission, not stored
    // NOTE: department_id removed - department is per-visit (appointment/admission), not per-patient
    phone_primary: z
      .string()
      .trim()
      .min(1, "Primary phone is required")
      .refine(validatePhoneDigits, {
        message: "Phone must be 8-15 digits (remove spaces or symbols)",
      }),
    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .optional()
      .or(z.literal("")),
    city: z
      .string()
      .trim()
      .min(2, "City must be 2-80 characters")
      .max(80, "City must be 2-80 characters"),
    create_visit_now: z.boolean().default(true),
  })
  .refine(
    (data) => {
      // If DOB unknown is checked, age is optional
      if (data.dob_unknown) {
        return true;
      }
      // If DOB unknown is NOT checked, DOB is required
      return !!data.dob;
    },
    {
      message: "Date of birth is required when DOB is known",
      path: ["dob"],
    }
  )
  .refine(
    (data) => {
      if (data.dob) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (data.dob > today) {
          return false;
        }
        const age =
          today.getFullYear() -
          data.dob.getFullYear() -
          (today.getMonth() < data.dob.getMonth() ||
          (today.getMonth() === data.dob.getMonth() &&
            today.getDate() < data.dob.getDate())
            ? 1
            : 0);
        return age >= 0 && age <= 120;
      }
      return true;
    },
    {
      message: "Date of birth cannot be in the future and age must be 0-120",
      path: ["dob"],
    }
  );

export type QuickRegisterFormValues = z.infer<typeof quickRegisterSchema>;

