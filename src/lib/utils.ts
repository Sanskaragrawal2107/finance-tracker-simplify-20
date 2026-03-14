
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('en-IN');
}

export function toDbDate(value?: Date | string | null): string {
  const dateValue = value instanceof Date ? value : value ? new Date(value) : new Date();
  return format(dateValue, 'yyyy-MM-dd');
}

export function parseDbDate(value?: string | Date | null): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }
  return new Date(value);
}
