import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns today's date in YYYY-MM-DD format for a specific timezone.
 * Defaults to America/Chicago (Central Time) which is relevant for MFC data.
 */
export function getTodayStr(timeZone: string = 'America/Chicago'): string {
  const date = new Date();
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(date);
}
