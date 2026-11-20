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
 * Extra discount during the customer's BIRTHDAY MONTH (owner's order,
 * 2026-11-19): it STACKS on the general member percent — with the
 * defaults the customer sees 20% all year and 25% in their birthday
 * month. Edited next to the general percent in «Datos de la óptica».
 */
export const BIRTHDAY_DISCOUNT_EXTRA_KEY = 'birthday_discount_extra_percent'

/** The owner's example when defining the extra ("otro 5"). */
export const DEFAULT_BIRTHDAY_DISCOUNT_EXTRA_PERCENT = 5

/** Hard cap for the stacked percent (general + birthday extra). */
export const MAX_EFFECTIVE_MEMBER_DISCOUNT_PERCENT = 95

/**
 * True when `dateOfBirth` ('YYYY-MM-DD', as stored in
 * customer_profiles.date_of_birth) falls in the same calendar month as
 * `now`. The month is read from the string itself so no timezone can
 * shift it; `now` is the server's clock at the call site.
 */
export function isBirthdayMonth(
  dateOfBirth: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!dateOfBirth) return false
  const match = /^\d{4}-(\d{2})-\d{2}/.exec(dateOfBirth)
  if (!match) return false
  return parseInt(match[1], 10) === now.getMonth() + 1
}

/**
 * The percent a logged-in customer actually gets: the general member
 * percent, plus the birthday extra during their birthday month,
 * capped at MAX_EFFECTIVE_MEMBER_DISCOUNT_PERCENT.
 */
export function effectiveMemberDiscountPercent(
  basePercent: number,
  birthdayExtraPercent: number,
  birthdayMonth: boolean
): number {
  if (!birthdayMonth) return basePercent
  return Math.min(basePercent + birthdayExtraPercent, MAX_EFFECTIVE_MEMBER_DISCOUNT_PERCENT)
}

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
