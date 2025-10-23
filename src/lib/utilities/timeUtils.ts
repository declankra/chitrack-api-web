// src/lib/utilities/timeUtils.ts
import type { Arrival } from '@/lib/types/cta';

/**
 * Time utility functions for CTA arrival data
 */

/**
 * Format the relative time since last update
 * @param date Last updated timestamp
 * @param currentTime Current time
 */
export const formatRelativeTime = (date: Date | null, currentTime: Date): string => {
  if (!date) return '';
  const diffMs = currentTime.getTime() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  return `${diffMins}m ago`;
};

/**
 * Parses a CTA date string into a JavaScript Date object
 * Handles both CTA format "YYYYMMDD HH:mm:ss" and ISO 8601 format
 * @param dateString CTA date string
 * @returns Date object or null if parsing fails
 */
export const parseCtaDate = (dateString: string): Date | null => {
  try {
    // Check if it's ISO format (contains 'T')
    if (dateString.includes('T')) {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // Handle CTA format "YYYYMMDD HH:mm:ss"
    const [datePart, timePart] = dateString.split(" ");
    if (!datePart || !timePart) return null;
    
    const year = +datePart.slice(0, 4);
    const month = +datePart.slice(4, 6) - 1; // zero-based
    const day = +datePart.slice(6, 8);
    
    const timePieces = timePart.split(":");
    const hour = Number(timePieces[0] ?? 0);
    const minute = Number(timePieces[1] ?? 0);
    const second = Number(timePieces[2] ?? 0);
    
    const date = new Date(year, month, day, hour, minute, second);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.warn('Error parsing CTA date:', dateString, error);
    return null;
  }
};

/**
 * Calculate minutes until arrival
 * @param arrivalTime Arrival time (Date object)
 * @param currentTime Current time (Date object)
 */
export const getMinutesUntil = (arrivalTime: Date, currentTime: Date = new Date()): number => {
  const diffMs = arrivalTime.getTime() - currentTime.getTime();
  return Math.round(diffMs / 60000);
};

/**
 * Format time to display in 12-hour format with AM/PM
 * @param date Date object to format
 */
export const formatTimeDisplay = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

/**
 * Helper to get greeting based on time of day
 */
export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 6) return 'Good early morning';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

/**
 * Filters out arrivals that are too old to be relevant
 * @param arrivals Array of arrivals to filter
 * @param maxPastMinutes Maximum number of minutes in the past to still show an arrival
 * @param currentTime Current time (defaults to now)
 * @returns Filtered array of arrivals
 */
export const filterStaleArrivals = (arrivals: Arrival[], maxPastMinutes: number = 2, currentTime: Date = new Date()): Arrival[] => {
  if (!arrivals || arrivals.length === 0) return [];
  
  // Simply filter and return - no fallback needed
  return arrivals.filter(arrival => {
    const arrTime = parseCtaDate(arrival.arrT);
    if (!arrTime) return false; // Invalid time
    
    const diffMs = arrTime.getTime() - currentTime.getTime();
    const diffMin = diffMs / 60000;
    
    // Only show arrivals in the future or very recently past
    return diffMin > -maxPastMinutes;
  });
};
