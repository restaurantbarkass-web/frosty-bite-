/**
 * Order ID generation and formatting utilities for Frosty Bite.
 * Ensures all order IDs start with 'FB-' prefix.
 */

/**
 * Generates a clean, unique order ID starting with 'FB-'.
 * Example output: 'FB-984215' or 'FB-7A2B9C'
 */
export const generateOrderId = (): string => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomCode = '';
  for (let i = 0; i < 6; i++) {
    randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `FB-${randomCode}`;
};

/**
 * Formats an order ID for UI and notifications.
 * Preserves the 'FB' prefix if present, or formats legacy IDs with 'FB-' prefix.
 */
export const formatOrderId = (id?: string | null): string => {
  if (!id) return 'UNKNOWN';
  const clean = String(id).trim().toUpperCase();
  if (clean.startsWith('FB')) {
    return clean;
  }
  // Legacy orders without FB prefix
  const short = clean.length > 8 ? clean.slice(-6) : clean;
  return `FB-${short}`;
};

/**
 * Gets formatted display order number with hash symbol, e.g. '#FB-984215'
 */
export const formatOrderNumberWithHash = (id?: string | null): string => {
  const formatted = formatOrderId(id);
  return `#${formatted}`;
};
