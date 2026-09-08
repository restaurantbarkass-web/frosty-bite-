/**
 * Safely trims a value if it is a string.
 * Returns an empty string if the value is null, undefined, or not a string.
 */
export const safeTrim = (val: any): string => {
  if (val === null || val === undefined) return '';
  if (typeof val !== 'string') return String(val).trim();
  return val.trim();
};

/**
 * Safely converts a value to lower case and trims it.
 */
export const safeTrimLowerCase = (val: any): string => {
  return safeTrim(val).toLowerCase();
};
