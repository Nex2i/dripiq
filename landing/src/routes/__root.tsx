import {
  createRootRoute,
  Outlet,
  ScrollRestoration,
  useRouter,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import Header from '@/components/shared/Header'
import Footer from '@/components/shared/Footer'
import SEOHead from '@/components/shared/SEOHead'

function ScrollToTopOnRouteChange() {
  const router = useRouter()

  useEffect(() => {
    // Scroll to top when route changes, but not on initial load
    const unsubscribe = router.subscribe('onLoad', () => {
      // Only scroll to top if it's not a hash navigation (anchor link)
      if (!window.location.hash) {
        window.scrollTo(0, 0)
      }
    })

    return unsubscribe
  }, [router])

  return null
}

export const Route = createRootRoute({
  component: () => (
    <>
      <SEOHead />
      <ScrollToTopOnRouteChange />
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
      <ScrollRestoration />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </>
  ),
})
