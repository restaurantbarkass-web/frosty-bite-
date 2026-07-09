/**
 * @file otp.service.js
 * @description OTP Service for authentication using an in-memory Map for development.
 * Offers standard CRUD operations, security attempt counters, expiration checks, and random secure generation.
 */

const crypto = require('crypto');

// In-memory store for OTP records
const otpStore = new Map();

/**
 * Generates a secure random 6-digit numeric string.
 * @returns {string} A 6-digit OTP string.
 */
function generateOTP() {
  if (typeof crypto.randomInt === 'function') {
    return String(crypto.randomInt(100000, 1000000));
  }
  
  // Fallback for environments lacking crypto.randomInt
  const randomBytes = crypto.randomBytes(4);
  const u32 = randomBytes.readUInt32BE(0);
  const otp = 100000 + (u32 % 900000);
  return String(otp);
}

/**
 * Stores the OTP record for a given phone number with standard metadata.
 * Valid for 5 minutes.
 * @param {string} phone - The recipient's phone number.
 * @param {string} otp - The 6-digit OTP code.
 */
function saveOTP(phone, otp) {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 5 * 60 * 1000); // 5 minutes expiration
  
  otpStore.set(phone, {
    phone,
    otp,
    createdAt,
    expiresAt,
    attempts: 0
  });
}

/**
 * Retrieves the OTP record for a given phone number.
 * @param {string} phone - The recipient's phone number.
 * @returns {object|null} The stored record or null if not found.
 */
function getOTP(phone) {
  return otpStore.get(phone) || null;
}

/**
 * Removes the OTP record for a given phone number.
 * @param {string} phone - The recipient's phone number.
 * @returns {boolean} True if the record was successfully deleted.
 */
function deleteOTP(phone) {
  return otpStore.delete(phone);
}

/**
 * Increments the failed verification attempt count for a given phone number.
 * @param {string} phone - The recipient's phone number.
 * @returns {number} The updated attempt count, or 0 if no record exists.
 */
function incrementAttempts(phone) {
  const record = otpStore.get(phone);
  if (record) {
    record.attempts += 1;
    otpStore.set(phone, record);
    return record.attempts;
  }
  return 0;
}

/**
 * Checks if the OTP record for a given phone number has expired or doesn't exist.
 * @param {string} phone - The recipient's phone number.
 * @returns {boolean} True if the OTP is expired or not found.
 */
function isExpired(phone) {
  const record = otpStore.get(phone);
  if (!record) {
    return true;
  }
  return new Date() > record.expiresAt;
}

module.exports = {
  generateOTP,
  saveOTP,
  getOTP,
  deleteOTP,
  incrementAttempts,
  isExpired
};
