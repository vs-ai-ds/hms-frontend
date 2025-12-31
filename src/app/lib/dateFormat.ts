/**
 * Date formatting utility with configurable format
 * 
 * Format options:
 * - "DD/MM/YYYY" - Day/Month/Year (e.g., 22/12/2025)
 * - "MM/DD/YYYY" - Month/Day/Year (e.g., 12/22/2025)
 * - "YYYY-MM-DD" - ISO format (e.g., 2025-12-22)
 * - "DD-MM-YYYY" - Day-Month-Year (e.g., 22-12-2025)
 */

// Get date format from environment variable or default to DD/MM/YYYY
const DATE_FORMAT = (import.meta.env.VITE_DATE_FORMAT || "DD/MM/YYYY").toUpperCase();

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY";

/**
 * Format a date according to the configured format
 * @param date - Date object or date string
 * @param includeTime - Whether to include time (default: false)
 * @returns Formatted date string
 */
export function formatDate(date: Date | string | null | undefined, includeTime: boolean = false): string {
  if (!date) return "-";
  
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return "-";
  
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, "0");
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  const seconds = String(dateObj.getSeconds()).padStart(2, "0");
  
  let formatted: string;
  
  switch (DATE_FORMAT as DateFormat) {
    case "DD/MM/YYYY":
      formatted = `${day}/${month}/${year}`;
      break;
    case "MM/DD/YYYY":
      formatted = `${month}/${day}/${year}`;
      break;
    case "YYYY-MM-DD":
      formatted = `${year}-${month}-${day}`;
      break;
    case "DD-MM-YYYY":
      formatted = `${day}-${month}-${year}`;
      break;
    default:
      formatted = `${day}/${month}/${year}`; // Default to DD/MM/YYYY
  }
  
  if (includeTime) {
    formatted += ` ${hours}:${minutes}:${seconds}`;
  }
  
  return formatted;
}

/**
 * Format a date with time
 * @param date - Date object or date string
 * @returns Formatted date and time string
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  return formatDate(date, true);
}

/**
 * Get the current date format setting
 * @returns The configured date format
 */
export function getDateFormat(): DateFormat {
  return DATE_FORMAT as DateFormat;
}
