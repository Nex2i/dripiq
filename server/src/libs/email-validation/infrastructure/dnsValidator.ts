import { promisify } from 'util';
import { resolveMx } from 'dns';
import { MxRecordInfo } from '../types/emailValidation.types';

/**
 * Infrastructure service for DNS/MX record validation
 */
export class DnsValidator {
  private readonly resolveMxAsync = promisify(resolveMx);

  /**
   * Validates MX records for a domain
   */
  async validateMxRecords(domain: string): Promise<MxRecordInfo> {
    try {
      const mxRecords = await this.resolveMxAsync(domain);

      if (!mxRecords || mxRecords.length === 0) {
        return {
          found: false,
          primaryRecord: null,
          allRecords: [],
        };
      }

      // Sort by priority (lower number = higher priority)
      const sortedRecords = mxRecords
        .sort((a, b) => a.priority - b.priority)
        .map((record) => record.exchange);

      return {
        found: true,
        primaryRecord: sortedRecords[0] || null,
        allRecords: sortedRecords,
      };
    } catch (_error) {
      // Domain doesn't exist or DNS resolution failed
      return {
        found: false,
        primaryRecord: null,
        allRecords: [],
      };
    }
  }

  /**
   * Checks if domain has valid MX records (simplified check)
   */
  async hasMxRecords(domain: string): Promise<boolean> {
    const mxInfo = await this.validateMxRecords(domain);
    return mxInfo.found;
  }

  /**
   * Gets the primary MX record for a domain
   */
  async getPrimaryMxRecord(domain: string): Promise<string | null> {
    const mxInfo = await this.validateMxRecords(domain);
    return mxInfo.primaryRecord;
  }
}
