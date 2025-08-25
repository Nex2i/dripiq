import {
  createRootRoute,
  Outlet,
  ScrollRestoration,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import Header from '@/components/shared/Header'
import Footer from '@/components/shared/Footer'
import SEOHead from '@/components/shared/SEOHead'

export const Route = createRootRoute({
  component: () => (
    <>
      <SEOHead />
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
