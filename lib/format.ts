/**
 * Format currency amount using Intl.NumberFormat.
 * @param amount - Numeric amount
 * @param currency - ISO 4217 currency code: 'CRC' | 'EUR'
 */
export function formatCurrency(amount: number, currency: "CRC" | "EUR" = "CRC"): string {
  const locale = currency === "EUR" ? "es-ES" : "es-CR";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}
