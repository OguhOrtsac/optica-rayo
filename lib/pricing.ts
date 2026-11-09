/**
 * Member pricing helpers.
 * Visitors see the catalog (visitor) price. Logged-in customers see:
 *   1) the product's special client_price when the admin set one, or
 *   2) the visitor price minus the general member discount percent.
 * The owner chose to support BOTH mechanisms.
 */

export const MEMBER_DISCOUNT_KEY = 'member_discount_percent'

/** The owner's example when defining the feature ("un 20% menos"). */
export const DEFAULT_MEMBER_DISCOUNT_PERCENT = 20

/**
 * Effective price for a logged-in customer.
 * Returns the visitor price unchanged when no benefit applies.
 */
export function effectiveClientPrice(
  visitorPrice: number,
  clientPrice: number | null | undefined,
  discountPercent: number
): number {
  if (clientPrice != null && clientPrice >= 0 && clientPrice < visitorPrice) {
    return clientPrice
  }
  if (discountPercent > 0 && discountPercent <= 100) {
    return Math.round(visitorPrice * (1 - discountPercent / 100) * 100) / 100
  }
  return visitorPrice
}
