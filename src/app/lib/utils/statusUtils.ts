// src/app/lib/utils/statusUtils.ts

/**
 * Shared status label and color utilities for consistent status display.
 */

export type AppointmentStatus =
  | "SCHEDULED"
  | "CHECKED_IN"
  | "IN_CONSULTATION"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED";

export type PrescriptionStatus = "DRAFT" | "ISSUED" | "DISPENSED" | "CANCELLED";

export type StatusColor =
  | "default"
  | "primary"
  | "secondary"
  | "error"
  | "warning"
  | "info"
  | "success";

export function getAppointmentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    SCHEDULED: "Scheduled",
    CHECKED_IN: "Checked-in",
    IN_CONSULTATION: "In consultation",
    COMPLETED: "Completed",
    NO_SHOW: "No Show",
    CANCELLED: "Cancelled",
  };
  return labels[status] ?? status ?? "-";
}

export function getAppointmentStatusColor(status: string): StatusColor {
  const colors: Record<string, StatusColor> = {
    SCHEDULED: "info",
    CHECKED_IN: "warning",
    IN_CONSULTATION: "warning",
    COMPLETED: "success",
    NO_SHOW: "default",
    CANCELLED: "error",
  };
  return colors[status] ?? "default";
}

export function getPrescriptionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    ISSUED: "Issued",
    DISPENSED: "Dispensed",
    CANCELLED: "Cancelled",
  };
  return labels[status] ?? status ?? "-";
}

export function getPrescriptionStatusColor(status: string): StatusColor {
  const colors: Record<string, StatusColor> = {
    DRAFT: "warning",
    ISSUED: "info",
    DISPENSED: "success",
    CANCELLED: "default",
  };
  return colors[status] ?? "default";
}