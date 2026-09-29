const PLACE = new Intl.PluralRules('en', { type: 'ordinal' })
const SUFFIX: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' }

/** 1st, 2nd, 3rd, 4th — a standing reads as a place, not an index. */
export const ordinal = (n: number) => `${n}${SUFFIX[PLACE.select(n)]}`
