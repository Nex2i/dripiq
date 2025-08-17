import { parsePhoneNumber } from 'awesome-phonenumber';
import { logger } from './logger';

/**
 * Phone number formatter utility for consistent phone number handling
 * across the application. Uses awesome-phonenumber for robust parsing and formatting.
 */
export class PhoneFormatter {
  /**
   * Formats a phone number to a consistent international format for database storage.
   * Returns the phone number in E.164 format (e.g., +1234567890) if valid,
   * or null if the phone number is invalid.
   *
   * @param phoneNumber - The raw phone number string to format
   * @param defaultCountry - Default country code to use if not specified (default: 'US')
   * @returns Formatted phone number in E.164 format or null if invalid
   */
  static formatForStorage(
    phoneNumber: string | null | undefined,
    defaultCountry: string = 'US'
  ): string | null {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return null;
    }

    // Clean the input string
    const cleanedNumber = phoneNumber.trim();
    if (cleanedNumber === '') {
      return null;
    }

    try {
      // Parse the phone number using awesome-phonenumber
      const pn = parsePhoneNumber(cleanedNumber, { regionCode: defaultCountry });

      // Check if the number is valid
      if (pn.valid) {
        // Return in E.164 format for consistent storage
        return pn.number.e164;
      } else {
        logger.warn(`Invalid phone number provided: ${phoneNumber}`);
        return null;
      }
    } catch (error) {
      logger.warn(`Error parsing phone number: ${phoneNumber}`, error);
      return null;
    }
  }

  /**
   * Formats a phone number for display purposes.
   * Returns the phone number in national format if valid,
   * or the original input if parsing fails.
   *
   * @param phoneNumber - The phone number to format for display
   * @param defaultCountry - Default country code to use if not specified (default: 'US')
   * @returns Formatted phone number for display or original input if invalid
   */
  static formatForDisplay(
    phoneNumber: string | null | undefined,
    defaultCountry: string = 'US'
  ): string | null {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return null;
    }

    const cleanedNumber = phoneNumber.trim();
    if (cleanedNumber === '') {
      return null;
    }

    try {
      const pn = parsePhoneNumber(cleanedNumber, { regionCode: defaultCountry });

      if (pn.valid) {
        // Return in national format for better readability
        return pn.number.national;
      } else {
        // Return original if we can't parse it
        return cleanedNumber;
      }
    } catch (_error) {
      logger.warn(`Error formatting phone number for display: ${phoneNumber}`, _error);
      // Return original if parsing fails
      return cleanedNumber;
    }
  }

  /**
   * Validates if a phone number is valid.
   *
   * @param phoneNumber - The phone number to validate
   * @param defaultCountry - Default country code to use if not specified (default: 'US')
   * @returns true if the phone number is valid, false otherwise
   */
  static isValid(phoneNumber: string | null | undefined, defaultCountry: string = 'US'): boolean {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return false;
    }

    const cleanedNumber = phoneNumber.trim();
    if (cleanedNumber === '') {
      return false;
    }

    try {
      const pn = parsePhoneNumber(cleanedNumber, { regionCode: defaultCountry });
      return pn.valid;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Normalizes phone number for comparison purposes.
   * Returns just the digits for fuzzy matching and deduplication.
   *
   * @param phoneNumber - The phone number to normalize
   * @param defaultCountry - Default country code to use if not specified (default: 'US')
   * @returns Normalized phone number (digits only) or null if invalid
   */
  static normalizeForComparison(
    phoneNumber: string | null | undefined,
    defaultCountry: string = 'US'
  ): string | null {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return null;
    }

    const cleanedNumber = phoneNumber.trim();
    if (cleanedNumber === '') {
      return null;
    }

    try {
      const pn = parsePhoneNumber(cleanedNumber, { regionCode: defaultCountry });

      if (pn.valid) {
        // Get the number without formatting and remove country code for comparison
        const e164 = pn.number.e164;
        // Remove the + and any leading country code for comparison
        return e164.replace(/^\+1/, '').replace(/^\+/, '');
      } else {
        // Fallback to basic normalization for invalid numbers
        return cleanedNumber.replace(/[\s\-()[\]+]/g, '').replace(/^1/, '');
      }
    } catch (_error) {
      // Fallback to basic normalization if parsing fails
      return cleanedNumber.replace(/[\s\-()[\]+]/g, '').replace(/^1/, '');
    }
  }

  /**
   * Gets country information from a phone number.
   *
   * @param phoneNumber - The phone number to analyze
   * @param defaultCountry - Default country code to use if not specified (default: 'US')
   * @returns Country code (ISO 3166-1 alpha-2) or null if unable to determine
   */
  static getCountry(
    phoneNumber: string | null | undefined,
    defaultCountry: string = 'US'
  ): string | null {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return null;
    }

    const cleanedNumber = phoneNumber.trim();
    if (cleanedNumber === '') {
      return null;
    }

    try {
      const pn = parsePhoneNumber(cleanedNumber, { regionCode: defaultCountry });

      if (pn.valid) {
        return pn.regionCode;
      } else {
        return null;
      }
    } catch (_error) {
      return null;
    }
  }
}

/**
 * Convenience function for formatting phone numbers for database storage.
 * This is the primary function that should be used throughout the application
 * when saving phone numbers to the database.
 *
 * @param phoneNumber - The phone number to format
 * @param defaultCountry - Default country code (default: 'US')
 * @returns Formatted phone number in E.164 format or null if invalid
 */
export const formatPhoneForStorage = (
  phoneNumber: string | null | undefined,
  defaultCountry: string = 'US'
): string | null => {
  return PhoneFormatter.formatForStorage(phoneNumber, defaultCountry);
};

/**
 * Convenience function for formatting phone numbers for display.
 *
 * @param phoneNumber - The phone number to format
 * @param defaultCountry - Default country code (default: 'US')
 * @returns Formatted phone number for display or null if invalid
 */
export const formatPhoneForDisplay = (
  phoneNumber: string | null | undefined,
  defaultCountry: string = 'US'
): string | null => {
  return PhoneFormatter.formatForDisplay(phoneNumber, defaultCountry);
};

/**
 * Convenience function for validating phone numbers.
 *
 * @param phoneNumber - The phone number to validate
 * @param defaultCountry - Default country code (default: 'US')
 * @returns true if valid, false otherwise
 */
export const isValidPhone = (
  phoneNumber: string | null | undefined,
  defaultCountry: string = 'US'
): boolean => {
  return PhoneFormatter.isValid(phoneNumber, defaultCountry);
};

/**
 * Convenience function for normalizing phone numbers for comparison.
 *
 * @param phoneNumber - The phone number to normalize
 * @param defaultCountry - Default country code (default: 'US')
 * @returns Normalized phone number or null if invalid
 */
export const normalizePhoneForComparison = (
  phoneNumber: string | null | undefined,
  defaultCountry: string = 'US'
): string | null => {
  return PhoneFormatter.normalizeForComparison(phoneNumber, defaultCountry);
};
