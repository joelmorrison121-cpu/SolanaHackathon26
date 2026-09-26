import type { Currency } from "./bills";

export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) return NaN;
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function splitEvenly(totalCents: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) =>
    index < remainder ? base + 1 : base
  );
}

export function currencySymbol(_currency?: Currency): string {
  return "€";
}

export function formatMoney(cents: number, currency: Currency): string {
  const amount = fromCents(cents).toLocaleString("en-IE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol(currency)}${amount}`;
}

export function formatMoneyCompact(cents: number, currency: Currency): string {
  const amount = fromCents(cents);
  const hasCents = cents % 100 !== 0;
  const formatted = amount.toLocaleString("en-IE", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol(currency)}${formatted}`;
}
