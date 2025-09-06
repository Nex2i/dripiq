export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  content: string
  author: string
  publishedAt: string
  readTime: string
  tags: string[]
  ogImage?: string
  seo: {
    title: string
    description: string
    keywords: string[]
  }
}

// Import all individual blog posts
import {
  aiSalesAutomationGuide,
  coldLeadsConversionTactics,
  psychologyLeadReengagementTiming,
  crmIntegrationBestPracticesRoi,
  salesAutomationVsPersonalizationBalance,
  costOfIgnoredLeadsRevenueAnalysis,
  emailDeliverability2024SalesStrategies,
  aiDrivenLeadScoringPredictablePipeline,
  multiChannelOutreachMasteryBeyondEmail,
} from './blog-posts/index'

export const blogPosts: BlogPost[] = [
  aiSalesAutomationGuide,
  coldLeadsConversionTactics,
  psychologyLeadReengagementTiming,
  crmIntegrationBestPracticesRoi,
  salesAutomationVsPersonalizationBalance,
  costOfIgnoredLeadsRevenueAnalysis,
  emailDeliverability2024SalesStrategies,
  aiDrivenLeadScoringPredictablePipeline,
  multiChannelOutreachMasteryBeyondEmail,
]
