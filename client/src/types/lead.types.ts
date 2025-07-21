export interface LeadStatus {
  id: string
  status: 'New' | 'Scraping Site' | 'Analyzing Site' | 'Extracting Contacts' | 'Processed'
  createdAt: string
  updatedAt: string
}

export interface LeadPointOfContact {
  id: string
  name: string
  email: string
  phone?: string
  title?: string
  company?: string
  sourceUrl?: string
  manuallyReviewed: boolean
  createdAt: string
  updatedAt: string
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
}