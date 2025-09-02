/**
 * Constants for contact context identification
 * Used across contact extraction and processing modules
 */
export const CONTACT_CONTEXT = {
  WEBDATA_EMPLOYEE: 'WebData Employee',
  DEPARTMENT_SUFFIX: 'Department',
} as const;

export const CONTACT_CONFIDENCE = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type ContactContext = (typeof CONTACT_CONTEXT)[keyof typeof CONTACT_CONTEXT];
export type ContactConfidence = (typeof CONTACT_CONFIDENCE)[keyof typeof CONTACT_CONFIDENCE];
