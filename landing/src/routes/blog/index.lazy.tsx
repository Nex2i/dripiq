import { createLazyFileRoute } from '@tanstack/react-router'
import { blogPosts } from '@/data/blog-posts'
import BlogCard from '@/components/blog/BlogCard'
import SEOHead from '@/components/shared/SEOHead'

const BlogPage = () => {
  return (
    <>
      <SEOHead
        title="Sales & AI Blog | dripIq"
        description="Latest insights on sales automation, AI-powered lead re-engagement, and CRM optimization. Expert tips for converting cold leads into warm prospects."
        canonical="https://dripiq.ai/blog"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'dripIq Sales & AI Blog',
          description:
            'Expert insights on sales automation and AI-powered lead re-engagement',
          url: 'https://dripiq.ai/blog',
          publisher: {
            '@type': 'Organization',
            name: 'dripIq',
            logo: 'https://dripiq.ai/android-chrome-512x512.png',
          },
        }}
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-surface-900 mb-6">
            Sales & AI <span className="gradient-text">Blog</span>
          </h1>
          <p className="text-xl text-surface-600 max-w-3xl mx-auto">
            Expert insights on sales automation, lead re-engagement strategies,
            and AI-powered CRM optimization.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {blogPosts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>

        {blogPosts.length === 0 && (
          <div className="text-center py-16">
            <h2 className="text-2xl font-semibold text-surface-900 mb-4">
              Blog posts coming soon!
            </h2>
            <p className="text-surface-600">
              We're working on some amazing content about sales automation and
              AI. Check back soon for expert insights and strategies.
            </p>
          </div>
        )}
      </div>
    </>
  )
}

export const Route = createLazyFileRoute('/blog/')({
  component: BlogPage,
})
