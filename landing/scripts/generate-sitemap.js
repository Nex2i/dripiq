#!/usr/bin/env node

/**
 * Sitemap Generation Script for DripIQ Landing Page
 * Automatically generates sitemap.xml from static routes and blog posts
 */

import { promises as fs } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configuration
const SITE_URL = 'https://dripiq.ai'
const OUTPUT_PATH = resolve(__dirname, '../public/sitemap.xml')

// Route configuration with SEO settings
const STATIC_ROUTES = [
  {
    path: '/',
    priority: '1.0',
    changefreq: 'weekly',
  },
  {
    path: '/about',
    priority: '0.8',
    changefreq: 'monthly',
  },
  {
    path: '/contact',
    priority: '0.8',
    changefreq: 'monthly',
  },
  {
    path: '/pricing',
    priority: '0.9',
    changefreq: 'weekly',
  },
  {
    path: '/blog/',
    priority: '0.7',
    changefreq: 'weekly',
  },
]

/**
 * Dynamically import blog posts from the data files
 */
async function getBlogPosts() {
  try {
    // Get all blog post files from the blog-posts directory
    const blogPostsDir = resolve(__dirname, '../src/data/blog-posts')
    const files = await fs.readdir(blogPostsDir)

    // Filter for TypeScript files (excluding index.ts)
    const blogPostFiles = files.filter(
      (file) => file.endsWith('.ts') && file !== 'index.ts',
    )

    const slugs = []

    // Extract slugs from each blog post file
    for (const file of blogPostFiles) {
      const filePath = resolve(blogPostsDir, file)
      const content = await fs.readFile(filePath, 'utf-8')

      // Extract slug using regex
      const slugMatch = content.match(/slug:\s*['"`]([^'"`]+)['"`]/)
      if (slugMatch) {
        slugs.push(slugMatch[1])
      }
    }

    return slugs.map((slug) => ({
      path: `/blog/${slug}`,
      priority: '0.6',
      changefreq: 'monthly',
    }))
  } catch (error) {
    console.warn(
      'Warning: Could not load blog posts for sitemap:',
      error.message,
    )
    return []
  }
}

/**
 * Generate XML sitemap content
 */
function generateSitemapXML(routes) {
  const currentDate = new Date().toISOString().split('T')[0]

  const urlEntries = routes
    .map(
      (route) => `  <url>
    <loc>${SITE_URL}${route.path}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`
}

/**
 * Main sitemap generation function
 */
async function generateSitemap() {
  try {
    console.log('🗺️  Generating sitemap.xml...')

    // Get blog posts
    const blogRoutes = await getBlogPosts()
    console.log(`📝 Found ${blogRoutes.length} blog posts`)

    // Combine all routes
    const allRoutes = [...STATIC_ROUTES, ...blogRoutes]
    console.log(`🔗 Total routes: ${allRoutes.length}`)

    // Generate sitemap XML
    const sitemapXML = generateSitemapXML(allRoutes)

    // Write to file
    await fs.writeFile(OUTPUT_PATH, sitemapXML, 'utf-8')

    console.log(`✅ Sitemap generated successfully at: ${OUTPUT_PATH}`)
    console.log(`📍 Sitemap will be available at: ${SITE_URL}/sitemap.xml`)

    // Log routes for verification
    console.log('\n📋 Generated routes:')
    allRoutes.forEach((route) => {
      console.log(`   ${SITE_URL}${route.path} (priority: ${route.priority})`)
    })
  } catch (error) {
    console.error('❌ Error generating sitemap:', error)
    process.exit(1)
  }
}

// Run the script
generateSitemap()
