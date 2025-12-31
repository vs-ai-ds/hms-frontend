/**
 * Common date/time utility functions for consistent date/time handling across the application
 * 
 * Storage: All dates are stored in UTC (ISO 8601 format) in the backend
 * Display: Dates are displayed in local timezone for user convenience
 * 
 * This ensures consistency across frontend and backend:
 * - Frontend sends UTC ISO strings to backend
 * - Backend stores dates in UTC
 * - Frontend displays dates in local timezone
 */

/**
 * Format a Date object as YYYY-MM-DD in local timezone (not UTC)
 * This prevents timezone conversion issues when converting Date to string
 * @param date - Date object
 * @returns Date string in format YYYY-MM-DD (local timezone)
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date object as YYYY-MM-DDTHH:mm in local timezone (for datetime-local input)
 * @param date - Date object
 * @returns Date-time string in format YYYY-MM-DDTHH:mm (local timezone)
 */
export function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Parse a datetime-local string (YYYY-MM-DDTHH:mm) to a Date object
 * The string is interpreted as local time (not UTC)
 * @param dateTimeString - Date-time string in format YYYY-MM-DDTHH:mm
 * @returns Date object in local timezone
 */
export function parseDateTimeLocal(dateTimeString: string): Date {
  // datetime-local format is already in local timezone, so new Date() interprets it correctly
  return new Date(dateTimeString);
}

/**
 * Convert a local Date object to UTC ISO string for backend storage
 * @param localDate - Date object in local timezone
 * @returns ISO string in UTC (e.g., "2024-12-28T10:30:00.000Z")
 */
export function toUTCISOString(localDate: Date): string {
  return localDate.toISOString();
}

/**
 * Convert a UTC ISO string from backend to local Date object
 * @param utcISOString - ISO string in UTC (e.g., "2024-12-28T10:30:00.000Z")
 * @returns Date object in local timezone
 */
export function fromUTCISOString(utcISOString: string): Date {
  return new Date(utcISOString);
}

/**
 * Round minutes to the next 15-minute interval (00, 15, 30, 45)
 * @param date - Date object to round
 * @returns New Date object with minutes rounded to next 15-minute interval
 */
export function roundToNext15Minutes(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 15) * 15;
  
  if (roundedMinutes >= 60) {
    rounded.setHours(rounded.getHours() + 1);
    rounded.setMinutes(0);
  } else {
    rounded.setMinutes(roundedMinutes);
  }
  
  rounded.setSeconds(0);
  rounded.setMilliseconds(0);
  return rounded;
}

/**
 * Round minutes to the nearest 15-minute interval (00, 15, 30, 45)
 * @param date - Date object to round
 * @returns New Date object with minutes rounded to nearest 15-minute interval
 */
export function roundToNearest15Minutes(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  
  if (roundedMinutes >= 60) {
    rounded.setHours(rounded.getHours() + 1);
    rounded.setMinutes(0);
  } else {
    rounded.setMinutes(roundedMinutes);
  }
  
  rounded.setSeconds(0);
  rounded.setMilliseconds(0);
  return rounded;
}

/**
 * Get the next available 15-minute slot from now (for walk-in appointments)
 * Rounds up to the next 15-minute interval (00, 15, 30, 45)
 * @param addMinutes - Additional minutes to add before rounding (default: 0)
 * @returns Date object with the next available 15-minute slot
 */
export function getNext15MinuteSlot(addMinutes: number = 0): Date {
  const now = new Date();
  if (addMinutes > 0) {
    now.setMinutes(now.getMinutes() + addMinutes);
  }
  return roundToNext15Minutes(now);
}

/**
 * Validate that a date has minutes in 15-minute intervals (00, 15, 30, 45)
 * @param date - Date object to validate
 * @returns true if minutes are in valid 15-minute interval, false otherwise
 */
export function isValid15MinuteInterval(date: Date): boolean {
  const minutes = date.getMinutes();
  return minutes === 0 || minutes === 15 || minutes === 30 || minutes === 45;
}

/**
 * Get minimum datetime-local string for input (current time rounded to next 15 minutes)
 * @returns Date-time string in format YYYY-MM-DDTHH:mm
 */
export function getMinDateTimeLocal(): string {
  return formatDateTimeLocal(getNext15MinuteSlot());
}

