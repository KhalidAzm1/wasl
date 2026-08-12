import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined, locale = 'en-US') {
  if (!dateString) return 'Not specified';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(dateString: string | null | undefined, locale = 'en-US') {
  if (!dateString) return 'Not specified';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatPercentage(val: number) {
  return `${Math.round(val * 100)}%`;
}

export function getStatusColor(status: string | null | undefined): { text: string; dot: string } {
  const s = (status || '').toLowerCase();
  if (s.includes('complete')) {
    return { text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-600 dark:bg-emerald-400' };
  }
  if (s.includes('delay') || s.includes('blocked')) {
    return { text: 'text-red-600 dark:text-red-400', dot: 'bg-red-600 dark:bg-red-400' };
  }
  if (
    s.includes('not started') ||
    s.includes('not yet') ||
    s.includes('none')
  ) {
    return { text: 'text-muted-foreground', dot: 'bg-muted-foreground' };
  }
  return { text: 'text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-600 dark:bg-yellow-400' };
}
