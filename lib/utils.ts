import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Counts billing periods between start and end dates.
 * Only includes periods that START before end_date (excludes the period that would start on the last day).
 * Example: Feb 15 - Apr 15 = 2 months of lessons → 2 invoices (Feb 15, Mar 15), NOT Apr 15.
 */
export function countBillingPeriods(
  startDate: Date | string,
  endDate: Date | string,
  periodMonths: number = 1
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  let d = new Date(start);
  while (d < end) {
    count++;
    d.setMonth(d.getMonth() + periodMonths);
  }
  return count;
}

/**
 * Generates billing period start dates between start and end (exclusive of end).
 * Each date is the start of a billing period.
 */
export function* billingPeriodStarts(
  startDate: Date | string,
  endDate: Date | string,
  periodMonths: number = 1
): Generator<Date> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let d = new Date(start);
  while (d < end) {
    yield new Date(d);
    d.setMonth(d.getMonth() + periodMonths);
  }
}
