import { Currency } from "../libs/enums/currency.enum";

/**
 * Static exchange rates relative to the USD base (1 USD = RATE units of X).
 * Update manually as needed. Source of truth for all conversions + Stripe charges.
 */
export const FX_RATES: Record<Currency, number> = {
  [Currency.USD]: 1,
  [Currency.EUR]: 0.92,
  [Currency.GBP]: 0.79,
  [Currency.KWD]: 0.31,
  [Currency.UZS]: 12700,
};

/** Decimal places used for display rounding per currency. */
const DISPLAY_DECIMALS: Record<Currency, number> = {
  [Currency.USD]: 2,
  [Currency.EUR]: 2,
  [Currency.GBP]: 2,
  [Currency.KWD]: 3,
  [Currency.UZS]: 0,
};

// Stripe minor-unit rules (https://stripe.com/docs/currencies).
const STRIPE_ZERO_DECIMAL = new Set(["UZS"]); // charged as whole units
const STRIPE_THREE_DECIMAL = new Set(["KWD"]); // minor unit must be a multiple of 10

export const isSupportedCurrency = (value: string): value is Currency =>
  (Object.values(Currency) as string[]).includes(value?.toUpperCase());

export const normalizeCurrency = (value?: string): Currency => {
  const upper = (value ?? "").toUpperCase();
  return isSupportedCurrency(upper) ? (upper as Currency) : Currency.USD;
};

/** Convert a USD-base amount to the target currency, rounded for display. */
export const convertFromUsd = (amountUsd: number, currency: Currency): number => {
  const raw = amountUsd * FX_RATES[currency];
  const f = 10 ** DISPLAY_DECIMALS[currency];
  return Math.round(raw * f) / f;
};

/**
 * Converts a display amount (already in `currency`) to Stripe's smallest unit,
 * honoring zero- and three-decimal currency rules.
 */
export const toStripeMinorUnits = (amount: number, currency: Currency): number => {
  const code = currency.toUpperCase();
  if (STRIPE_ZERO_DECIMAL.has(code)) return Math.round(amount);
  if (STRIPE_THREE_DECIMAL.has(code)) {
    // 3-decimal currencies: amount * 1000, rounded to the nearest multiple of 10.
    return Math.round((amount * 1000) / 10) * 10;
  }
  return Math.round(amount * 100);
};
