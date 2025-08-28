import { LEAD_STATUS } from '../constants/leadStatus.constants'
import type { LeadStatus } from '../types/lead.types'

export interface StatusMessage {
  title: string
  description: string
  estimatedTime?: string
  isProcessing: boolean
}

export function getStatusMessage(statuses: LeadStatus[]): StatusMessage | null {
  if (!statuses || statuses.length === 0) {
    return null
  }

  // Get the most recent status
  const mostRecentStatus = statuses
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

  switch (mostRecentStatus.status) {
    case LEAD_STATUS.UNPROCESSED:
      return {
        title: 'Lead Not Processed',
        description: 'This lead has not been processed yet. Click "Resync" to start analysis.',
        isProcessing: false,
      }

    case LEAD_STATUS.INITIAL_PROCESSING:
      return {
        title: '🔄 Initial Processing',
        description: 'Getting the website\'s sitemap and intelligently filtering the most relevant pages to analyze. This step ensures we focus on the most important content.',
        estimatedTime: '1-2 minutes',
        isProcessing: true,
      }

    case LEAD_STATUS.SYNCING_SITE:
      return {
        title: '🌐 Syncing Website',
        description: 'Collecting and organizing website content for analysis. We\'re gathering the filtered pages and preparing them for AI processing.',
        estimatedTime: '2-5 minutes',
        isProcessing: true,
      }

    case LEAD_STATUS.SCRAPING_SITE:
      return {
        title: '🔍 Scraping Website Content',
        description: 'Gathering detailed information from website pages including text content, structure, and metadata for comprehensive analysis.',
        estimatedTime: '3-8 minutes',
        isProcessing: true,
      }

    case LEAD_STATUS.ANALYZING_SITE:
      return {
        title: '🧠 AI Analysis in Progress',
        description: 'Our AI is analyzing the website content to create a comprehensive business summary, identifying products, services, and key differentiators.',
        estimatedTime: '1-3 minutes',
        isProcessing: true,
      }

    case LEAD_STATUS.EXTRACTING_CONTACTS:
      return {
        title: '📞 Extracting Contact Information',
        description: 'Finding and organizing contact information from the website, including key decision makers and their details for outreach.',
        estimatedTime: '1-2 minutes',
        isProcessing: true,
      }

    case LEAD_STATUS.PROCESSED:
      return {
        title: '✅ Analysis Complete!',
        description: 'The website has been fully analyzed! Check the tabs below for AI-generated business summaries, extracted contacts, and insights ready for your outreach campaigns.',
        isProcessing: false,
      }

    default:
      return null
  }
}

export function getProcessingProgress(statuses: LeadStatus[]): { current: number; total: number; percentage: number } {
  const statusOrder = [
    LEAD_STATUS.UNPROCESSED,
    LEAD_STATUS.INITIAL_PROCESSING,
    LEAD_STATUS.SYNCING_SITE,
    LEAD_STATUS.SCRAPING_SITE,
    LEAD_STATUS.ANALYZING_SITE,
    LEAD_STATUS.EXTRACTING_CONTACTS,
    LEAD_STATUS.PROCESSED,
  ]

  if (!statuses || statuses.length === 0) {
    return { current: 0, total: statusOrder.length, percentage: 0 }
  }

  const mostRecentStatus = statuses
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

  const currentIndex = statusOrder.indexOf(mostRecentStatus.status as any)
  const current = currentIndex === -1 ? 0 : currentIndex + 1
  const total = statusOrder.length
  const percentage = Math.round((current / total) * 100)

  return { current, total, percentage }
}