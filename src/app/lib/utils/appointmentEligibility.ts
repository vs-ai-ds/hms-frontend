// src/app/lib/utils/appointmentEligibility.ts
import type { Appointment } from "../../../types/appointment";
import { AppointmentStatus } from "../../../types/appointment";

export interface EligibleOPDCriteria {
  allowPastWindowHours?: number; // default 2 hours
  allowFutureWindowHours?: number; // default 24 hours
}

export function isEligibleOPD(appointment: Appointment, criteria?: EligibleOPDCriteria): boolean {
  const { allowPastWindowHours = 2, allowFutureWindowHours = 24 } = criteria || {};

  if (
    appointment.status === AppointmentStatus.COMPLETED ||
    appointment.status === AppointmentStatus.CANCELLED ||
    appointment.status === AppointmentStatus.NO_SHOW
  ) {
    return false;
  }

  if (
    appointment.status === AppointmentStatus.CHECKED_IN ||
    appointment.status === AppointmentStatus.IN_CONSULTATION
  ) {
    return true;
  }

  if (appointment.status === AppointmentStatus.SCHEDULED) {
    const now = new Date();
    const scheduledAt = new Date(appointment.scheduled_at);

    const pastWindow = new Date(now.getTime() - allowPastWindowHours * 60 * 60 * 1000);
    const futureWindow = new Date(now.getTime() + allowFutureWindowHours * 60 * 60 * 1000);

    return scheduledAt >= pastWindow && scheduledAt <= futureWindow;
  }

  return false;
}

export function canCheckIn(appointment: Appointment, graceWindowHours: number = 0.5): boolean {
  // Backend: only SCHEDULED can be checked in
  if (appointment.status !== AppointmentStatus.SCHEDULED) return false;

  const now = new Date();
  const scheduledAt = new Date(appointment.scheduled_at);
  const graceWindow = new Date(now.getTime() - graceWindowHours * 60 * 60 * 1000);

  return scheduledAt >= graceWindow;
}

export function canStartConsultation(appointment: Appointment): boolean {
  // Backend allows start-consultation for SCHEDULED or CHECKED_IN, but only if scheduled date == today
  if (
    appointment.status !== AppointmentStatus.SCHEDULED &&
    appointment.status !== AppointmentStatus.CHECKED_IN
  ) {
    return false;
  }

  const scheduledAt = new Date(appointment.scheduled_at);
  const today = new Date();

  return scheduledAt.toDateString() === today.toDateString();
}

export function canCompleteVisit(appointment: Appointment): boolean {
  return (
    appointment.status === AppointmentStatus.CHECKED_IN ||
    appointment.status === AppointmentStatus.IN_CONSULTATION
  );
}

// Alias for canCompleteVisit - used for "Close Visit" action
export const canCloseVisit = canCompleteVisit;

export function canReschedule(appointment: Appointment): boolean {
  // Backend: SCHEDULED or CHECKED_IN only
  return (
    appointment.status === AppointmentStatus.SCHEDULED ||
    appointment.status === AppointmentStatus.CHECKED_IN
  );
}

export function canCancel(appointment: Appointment): boolean {
  // Backend: SCHEDULED or CHECKED_IN only
  return (
    appointment.status === AppointmentStatus.SCHEDULED ||
    appointment.status === AppointmentStatus.CHECKED_IN
  );
}

export function shouldMarkNoShow(appointment: Appointment, graceWindowMinutes: number = 180): boolean {
  if (appointment.status !== AppointmentStatus.SCHEDULED) return false;
  if (appointment.checked_in_at) return false;

  const now = new Date();
  const scheduledAt = new Date(appointment.scheduled_at);
  const graceEnd = new Date(scheduledAt.getTime() + graceWindowMinutes * 60 * 1000);

  return now > graceEnd;
}

/**
 * Get eligible OPD appointments from an array of appointments.
 * Filters appointments that are eligible for prescription writing.
 * @param appointments - Array of appointments to filter
 * @param criteria - Optional criteria for eligibility
 * @returns Array of eligible OPD appointments
 */
export function getEligibleOPDAppointments(
  appointments: Appointment[],
  criteria?: EligibleOPDCriteria
): Appointment[] {
  if (!appointments || appointments.length === 0) return [];
  return appointments.filter((apt) => isEligibleOPD(apt, criteria));
}

/**
 * Check if a patient has an active admission.
 * @param admissions - Array of admissions (can be null/undefined)
 * @returns true if patient has at least one active admission
 */
export function hasActiveAdmission(admissions: any[] | null | undefined): boolean {
  if (!admissions || !Array.isArray(admissions)) return false;
  return admissions.length > 0 && admissions.some((adm) => adm.status === "ACTIVE");
}

/**
 * Determines if a prescription can be written for a patient.
 * @param hasPermission - Whether the user has permission to create prescriptions
 * @param eligibleOPDCount - Number of eligible OPD appointments
 * @param hasActiveAdmission - Whether patient has an active IPD admission
 * @param allowWalkIn - Whether walk-in prescriptions are allowed
 * @returns true if prescription can be written
 */
export function canWriteRx(
  hasPermission: boolean,
  eligibleOPDCount: number,
  hasActiveAdmission: boolean,
  allowWalkIn: boolean = false
): boolean {
  if (!hasPermission) return false;
  
  // Can write if:
  // 1. Has eligible OPD appointments, OR
  // 2. Has active IPD admission, OR
  // 3. Walk-in is allowed
  return eligibleOPDCount > 0 || hasActiveAdmission || allowWalkIn;
}