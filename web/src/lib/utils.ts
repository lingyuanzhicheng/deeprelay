import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


function formatNumber(num: number | undefined, compare: number[], units: string[], digits: number = 2): { value: string, unit: string } {
  if (num === undefined) return { value: (0).toFixed(digits), unit: units[0] };
  else if (num >= compare[0]) return { value: (num / compare[0]).toFixed(digits), unit: units[1] };
  else if (num >= compare[1]) return { value: (num / compare[1]).toFixed(digits), unit: units[2] };
  else if (num >= compare[2]) return { value: (num / compare[2]).toFixed(digits), unit: units[3] };
  else if (num >= compare[3]) return { value: (num / compare[3]).toFixed(digits), unit: units[4] };
  else return { value: (num).toFixed(digits), unit: units[5] };
}

export function formatCount(num: number | undefined): { raw: number, formatted: { value: string, unit: string } } {
  return {
    raw: num ?? 0,
    formatted: formatNumber(num, [1000000000, 1000000, 1000, 1], ['', 'B', 'M', 'K', '', '']),
  };
}

export function formatCountInt(num: number | undefined): { raw: number, formatted: { value: string, unit: string } } {
  return {
    raw: num ?? 0,
    formatted: formatNumber(Math.round(num ?? 0), [1000000000, 1000000, 1000, 1], ['', 'B', 'M', 'K', '', ''], 0),
  };
}
export function formatMoney(num: number | undefined): { raw: number, formatted: { value: string, unit: string } } {
  return {
    raw: num ?? 0,
    formatted: formatNumber(num, [1000000000, 1000000, 1000, 1], ['$', 'B$', 'M$', 'K$', '$', '$']),
  };
}

export function formatTime(ms: number | undefined): { raw: number, formatted: { value: string, unit: string } } {
  return {
    raw: ms ?? 0,
    formatted: formatNumber(ms, [86400000, 3600000, 60000, 1000], ['', 'd', 'h', 'm', 's', 'ms']),
  };
}