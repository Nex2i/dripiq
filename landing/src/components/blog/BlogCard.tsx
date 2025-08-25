import { Link } from '@tanstack/react-router'
import { Clock, User, ArrowRight } from 'lucide-react'
import { BlogPost } from '@/data/blog-posts'

interface BlogCardProps {
  post: BlogPost
}

export default function BlogCard({ post }: BlogCardProps) {
  return (
    <article className="group bg-white rounded-2xl shadow-lg border border-surface-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      {/* Featured image placeholder */}
      <div className="aspect-[16/9] bg-gradient-to-br from-primary-100 to-accent-100 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-accent-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 bg-white/80 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <span className="text-2xl">📝</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-surface-900 mb-3 group-hover:text-primary-600 transition-colors line-clamp-2">
          <Link
            to="/blog/$slug"
            params={{ slug: post.slug }}
            className="hover:underline"
          >
            {post.title}
          </Link>
        </h3>

        {/* Excerpt */}
        <p className="text-surface-600 mb-4 line-clamp-3">{post.excerpt}</p>

        {/* Meta info */}
        <div className="flex items-center justify-between text-sm text-surface-500 mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <User className="h-4 w-4 mr-1" />
              <span>{post.author}</span>
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>{post.readTime}</span>
            </div>
          </div>
          <time dateTime={post.publishedAt}>
            {new Date(post.publishedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </time>
        </div>

        {/* Read more link */}
        <Link
          to="/blog/$slug"
          params={{ slug: post.slug }}
          className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium group/link"
        >
          Read Article
          <ArrowRight className="h-4 w-4 ml-1 group-hover/link:translate-x-1 transition-transform" />
        </Link>
      </div>
    </article>
  )
}
