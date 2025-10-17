import { createLazyFileRoute, notFound } from '@tanstack/react-router'
import { blogPosts } from '@/data/blog-posts'
import BlogPost from '@/components/blog/BlogPost'
import SEOHead from '@/components/shared/SEOHead'

const BlogPostPage = () => {
  const { slug } = Route.useParams()
  const post = blogPosts.find((p) => p.slug === slug)

  if (!post) {
    throw notFound()
  }

  return (
    <>
      <SEOHead
        title={post.seo.title}
        description={post.seo.description}
        canonical={`https://dripiq.ai/blog/${post.slug}`}
        ogImage={post.ogImage}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt,
          author: {
            '@type': 'Organization',
            name: post.author,
          },
          publisher: {
            '@type': 'Organization',
            name: 'dripIq',
            logo: 'https://dripiq.ai/android-chrome-512x512.png',
          },
          datePublished: post.publishedAt,
          dateModified: post.publishedAt,
          image: post.ogImage || 'https://dripiq.ai/android-chrome-512x512.png',
          url: `https://dripiq.ai/blog/${post.slug}`,
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://dripiq.ai/blog/${post.slug}`,
          },
        }}
      />
      <BlogPost post={post} />
    </>
  )
}

export const Route = createLazyFileRoute('/blog/$slug')({
  component: BlogPostPage,
})
