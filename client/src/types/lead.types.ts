import type { LeadStatusValue } from '../constants/leadStatus.constants'

export interface LeadStatus {
  id: string
  status: LeadStatusValue
  createdAt: string
  updatedAt: string
}

export interface LeadPointOfContact {
  id: string
  name: string
  email: string
  emailVerificationResult?: 'valid' | 'invalid' | 'unknown' | 'ok_for_all' | 'inferred'
  phone?: string
  title?: string
  company?: string
  sourceUrl?: string
  manuallyReviewed: boolean
  strategyStatus?: 'none' | 'generating' | 'completed' | 'failed'
  isUnsubscribed?: boolean
  createdAt: string
  updatedAt: string
}

export interface AttachedProduct {
  id: string
  leadId: string
  productId: string
  attachedAt: string
  createdAt: string
  updatedAt: string
  product: {
    id: string
    title: string
    description?: string
    salesVoice?: string
    siteUrl?: string
    tenantId: string
    createdAt: string
    updatedAt: string
  }
}

export interface Lead {
  id: string
  name: string
  url: string
  status: string
  summary?: string
  products?: string[]
  services?: string[]
  differentiators?: string[]
  targetMarket?: string
  tone?: string
  logo?: string | null
  brandColors?: string[]
  primaryContactId?: string
  ownerId?: string
  createdAt: string
  updatedAt: string
  pointOfContacts?: LeadPointOfContact[]
  statuses?: LeadStatus[]
  attachedProducts?: AttachedProduct[]
}
