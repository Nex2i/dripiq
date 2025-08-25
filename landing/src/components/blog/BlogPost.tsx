import { Link } from '@tanstack/react-router'
import { ArrowLeft, Clock, User, Share2, Calendar } from 'lucide-react'
import { BlogPost as BlogPostType } from '@/data/blog-posts'

interface BlogPostProps {
  post: BlogPostType
}

export default function BlogPost({ post }: BlogPostProps) {
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: post.title,
        text: post.excerpt,
        url: window.location.href,
      })
    } else {
      // Fallback to copying URL
      navigator.clipboard.writeText(window.location.href)
    }
  }

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Back to blog link */}
      <div className="mb-8">
        <Link
          to="/blog"
          className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium group"
        >
          <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Blog
        </Link>
      </div>

      {/* Header */}
      <header className="mb-12">
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-6">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-surface-900 mb-6 leading-tight">
          {post.title}
        </h1>

        {/* Excerpt */}
        <p className="text-xl text-surface-600 mb-8 leading-relaxed">
          {post.excerpt}
        </p>

        {/* Meta info */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-t border-surface-200 pt-6">
          <div className="flex items-center space-x-6 text-surface-600 mb-4 sm:mb-0">
            <div className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              <span className="font-medium">{post.author}</span>
            </div>
            <div className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </time>
            </div>
            <div className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              <span>{post.readTime}</span>
            </div>
          </div>

          <button
            onClick={handleShare}
            className="inline-flex items-center px-4 py-2 border border-surface-300 rounded-lg text-surface-700 hover:bg-surface-50 transition-colors"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </button>
        </div>
      </header>

      {/* Featured image placeholder */}
      <div className="aspect-[16/9] bg-gradient-to-br from-primary-100 to-accent-100 rounded-2xl mb-12 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 bg-white/80 rounded-full flex items-center justify-center">
            <span className="text-4xl">📝</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="prose prose-lg max-w-none">
        <div
          className="text-surface-700 leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: post.content
              .split('\n')
              .map((line) => {
                // Convert markdown-style headers
                if (line.startsWith('# ')) {
                  return `<h1 class="text-3xl font-bold text-surface-900 mt-12 mb-6">${line.slice(2)}</h1>`
                }
                if (line.startsWith('## ')) {
                  return `<h2 class="text-2xl font-bold text-surface-900 mt-10 mb-4">${line.slice(3)}</h2>`
                }
                if (line.startsWith('### ')) {
                  return `<h3 class="text-xl font-semibold text-surface-900 mt-8 mb-3">${line.slice(4)}</h3>`
                }
                // Convert markdown links
                const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
                line = line.replace(
                  linkRegex,
                  '<a href="$2" class="text-primary-600 hover:text-primary-700 underline">$1</a>',
                )

                // Convert bold text
                line = line.replace(
                  /\*\*([^*]+)\*\*/g,
                  '<strong class="font-semibold">$1</strong>',
                )

                // Handle lists
                if (line.startsWith('- ')) {
                  return `<li class="mb-2">${line.slice(2)}</li>`
                }

                // Handle code blocks
                if (line.startsWith('```')) {
                  return line.includes('```') && line.length > 3
                    ? ''
                    : '<pre class="bg-surface-100 p-4 rounded-lg my-6 overflow-x-auto"><code>'
                }
                if (line === '```') {
                  return '</code></pre>'
                }

                // Regular paragraphs
                if (line.trim() && !line.startsWith('<')) {
                  return `<p class="mb-6">${line}</p>`
                }

                return line
              })
              .join('\n'),
          }}
        />
      </div>

      {/* CTA section */}
      <div className="mt-16 p-8 bg-gradient-to-r from-primary-50 to-accent-50 rounded-2xl">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-surface-900 mb-4">
            Ready to Transform Your Sales Process?
          </h3>
          <p className="text-surface-600 mb-6 max-w-2xl mx-auto">
            See how dripIq's AI-powered platform can help you implement these
            strategies automatically and turn your dormant leads into active
            opportunities.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://app.dripiq.ai/signup"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 transition-colors"
            >
              Start Free Trial
            </a>
            <a
              href="/contact"
              className="inline-flex items-center justify-center px-6 py-3 border border-primary-600 text-base font-medium rounded-lg text-primary-600 bg-white hover:bg-primary-50 transition-colors"
            >
              Schedule Demo
            </a>
          </div>
        </div>
      </div>

      {/* Related articles */}
      <div className="mt-16 border-t border-surface-200 pt-12">
        <h3 className="text-2xl font-bold text-surface-900 mb-8 text-center">
          Continue Reading
        </h3>
        <div className="text-center">
          <Link
            to="/blog"
            className="inline-flex items-center justify-center px-6 py-3 border border-surface-300 text-base font-medium rounded-lg text-surface-700 hover:bg-surface-50 transition-colors"
          >
            View All Articles
          </Link>
        </div>
      </div>
    </article>
  )
}
