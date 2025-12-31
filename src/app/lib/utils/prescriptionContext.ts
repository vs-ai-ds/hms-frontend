/**
 * Utilities for prescription context selection and validation
 */

export type VisitType = "OPD" | "IPD";

export interface PrescriptionContext {
  visitType: VisitType;
  appointmentId?: string; // For OPD
  admissionId?: string; // For IPD
  isWalkIn?: boolean; // For walk-in OPD (no appointment)
}

/**
 * Determine default prescription context based on patient state
 */
export function getDefaultPrescriptionContext(
  hasActiveAdmission: boolean,
  eligibleOPDCount: number
): PrescriptionContext {
  // If patient is admitted, default to IPD
  if (hasActiveAdmission) {
    return {
      visitType: "IPD",
    };
  }

  // Default to OPD if eligible appointments exist
  if (eligibleOPDCount > 0) {
    return {
      visitType: "OPD",
    };
  }

  // Default to walk-in OPD if no eligible appointments
  return {
    visitType: "OPD",
    isWalkIn: true,
  };
}

/**
 * Check if OPD selection should be disabled
 */
export function isOPDDisabled(hasActiveAdmission: boolean): boolean {
  return hasActiveAdmission;
}

/**
 * Get OPD disabled reason message
 */
export function getOPDDisabledReason(hasActiveAdmission: boolean): string | null {
  if (hasActiveAdmission) {
    return "Patient is currently admitted. Create IPD prescription instead.";
  }
  return null;
}
