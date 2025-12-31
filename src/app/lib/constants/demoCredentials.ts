/**
 * Demo account credentials
 * These match the credentials defined in Backend/scripts/seed_demo_data.py
 * 
 * Email format: {username}@demo-tenant-{suffix}.hms
 * Password: Demo@12345 (same for all demo accounts)
 */

export const DEMO_PASSWORD = "Demo@12345";
export const DEMO_EMAIL_TLD = "hms";

export const getDemoEmail = (suffix: "a" | "b", username: string): string => {
  return `${username}@demo-tenant-${suffix}.${DEMO_EMAIL_TLD}`;
};

export const DEMO_ACCOUNTS = {
  A: {
    admin: { 
      email: getDemoEmail("a", "admin"), 
      password: DEMO_PASSWORD,
      role: "HOSPITAL_ADMIN" as const,
    },
    doctor: { 
      email: getDemoEmail("a", "doctor1"), 
      password: DEMO_PASSWORD,
      role: "DOCTOR" as const,
    },
    nurse: { 
      email: getDemoEmail("a", "nurse1"), 
      password: DEMO_PASSWORD,
      role: "NURSE" as const,
    },
    pharmacist: { 
      email: getDemoEmail("a", "pharmacist1"), 
      password: DEMO_PASSWORD,
      role: "PHARMACIST" as const,
    },
    receptionist: { 
      email: getDemoEmail("a", "receptionist1"), 
      password: DEMO_PASSWORD,
      role: "RECEPTIONIST" as const,
    },
  },
  B: {
    admin: { 
      email: getDemoEmail("b", "admin"), 
      password: DEMO_PASSWORD,
      role: "HOSPITAL_ADMIN" as const,
    },
    doctor: { 
      email: getDemoEmail("b", "doctor1"), 
      password: DEMO_PASSWORD,
      role: "DOCTOR" as const,
    },
    nurse: { 
      email: getDemoEmail("b", "nurse1"), 
      password: DEMO_PASSWORD,
      role: "NURSE" as const,
    },
    pharmacist: { 
      email: getDemoEmail("b", "pharmacist1"), 
      password: DEMO_PASSWORD,
      role: "PHARMACIST" as const,
    },
    receptionist: { 
      email: getDemoEmail("b", "receptionist1"), 
      password: DEMO_PASSWORD,
      role: "RECEPTIONIST" as const,
    },
  },
} as const;

