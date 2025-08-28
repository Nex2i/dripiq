import { describe, it, expect } from 'vitest'
import { getStatusMessage, getProcessingProgress } from './leadStatusMessages'
import { LEAD_STATUS } from '../constants/leadStatus.constants'
import type { LeadStatus } from '../types/lead.types'

describe('leadStatusMessages', () => {
  const createMockStatus = (status: string, createdAt = new Date()): LeadStatus => ({
    id: 'mock-id',
    leadId: 'mock-lead-id',
    status,
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
  })

  describe('getStatusMessage', () => {
    it('should return null for empty statuses', () => {
      expect(getStatusMessage([])).toBeNull()
      expect(getStatusMessage(null as any)).toBeNull()
    })

    it('should return correct message for UNPROCESSED', () => {
      const statuses = [createMockStatus(LEAD_STATUS.UNPROCESSED)]
      const message = getStatusMessage(statuses)

      expect(message).toEqual({
        title: 'Lead Not Processed',
        description: 'This lead has not been processed yet. Click "Resync" to start analysis.',
        isProcessing: false,
      })
    })

    it('should return correct message for INITIAL_PROCESSING', () => {
      const statuses = [createMockStatus(LEAD_STATUS.INITIAL_PROCESSING)]
      const message = getStatusMessage(statuses)

      expect(message).toEqual({
        title: '🔄 Initial Processing',
        description: 'Getting the website\'s sitemap and intelligently filtering the most relevant pages to analyze. This step ensures we focus on the most important content.',
        estimatedTime: '1-2 minutes',
        isProcessing: true,
      })
    })

    it('should return correct message for SYNCING_SITE', () => {
      const statuses = [createMockStatus(LEAD_STATUS.SYNCING_SITE)]
      const message = getStatusMessage(statuses)

      expect(message).toEqual({
        title: '🌐 Syncing Website',
        description: 'Collecting and organizing website content for analysis. We\'re gathering the filtered pages and preparing them for AI processing.',
        estimatedTime: '2-5 minutes',
        isProcessing: true,
      })
    })

    it('should return correct message for PROCESSED', () => {
      const statuses = [createMockStatus(LEAD_STATUS.PROCESSED)]
      const message = getStatusMessage(statuses)

      expect(message).toEqual({
        title: '✅ Analysis Complete!',
        description: 'The website has been fully analyzed! Check the tabs below for AI-generated business summaries, extracted contacts, and insights ready for your outreach campaigns.',
        isProcessing: false,
      })
    })

    it('should use most recent status when multiple statuses exist', () => {
      const olderDate = new Date('2024-01-01')
      const newerDate = new Date('2024-01-02')
      
      const statuses = [
        createMockStatus(LEAD_STATUS.INITIAL_PROCESSING, olderDate),
        createMockStatus(LEAD_STATUS.SYNCING_SITE, newerDate),
      ]
      const message = getStatusMessage(statuses)

      expect(message?.title).toBe('🌐 Syncing Website')
    })
  })

  describe('getProcessingProgress', () => {
    it('should return 0% for empty statuses', () => {
      const progress = getProcessingProgress([])
      expect(progress).toEqual({
        current: 0,
        total: 7,
        percentage: 0,
      })
    })

    it('should calculate correct progress for INITIAL_PROCESSING', () => {
      const statuses = [createMockStatus(LEAD_STATUS.INITIAL_PROCESSING)]
      const progress = getProcessingProgress(statuses)

      expect(progress).toEqual({
        current: 2,
        total: 7,
        percentage: 29, // Math.round((2/7) * 100)
      })
    })

    it('should calculate correct progress for PROCESSED', () => {
      const statuses = [createMockStatus(LEAD_STATUS.PROCESSED)]
      const progress = getProcessingProgress(statuses)

      expect(progress).toEqual({
        current: 7,
        total: 7,
        percentage: 100,
      })
    })

    it('should use most recent status for progress calculation', () => {
      const olderDate = new Date('2024-01-01')
      const newerDate = new Date('2024-01-02')
      
      const statuses = [
        createMockStatus(LEAD_STATUS.INITIAL_PROCESSING, olderDate),
        createMockStatus(LEAD_STATUS.ANALYZING_SITE, newerDate),
      ]
      const progress = getProcessingProgress(statuses)

      expect(progress.current).toBe(5) // ANALYZING_SITE is 5th in the order
    })

    it('should handle unknown status gracefully', () => {
      const statuses = [createMockStatus('UNKNOWN_STATUS')]
      const progress = getProcessingProgress(statuses)

      expect(progress).toEqual({
        current: 0,
        total: 7,
        percentage: 0,
      })
    })
  })
})