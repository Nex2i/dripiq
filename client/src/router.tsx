import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

// Import components and pages
import App from './App'
import Header from './components/Header'
import { AuthGuard, PublicOnlyGuard } from './components/AuthGuard'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

// Import demo route functions
import FormSimpleDemo from './routes/demo.form.simple'
import FormAddressDemo from './routes/demo.form.address'
import StoreDemo from './routes/demo.store'
import TableDemo from './routes/demo.table'
import TanStackQueryDemo from './routes/demo.tanstack-query'

// Import layout components
import TanStackQueryLayout from './integrations/tanstack-query/layout'
import * as TanStackQueryProvider from './integrations/tanstack-query/root-provider'

// Root route with header
const rootRoute = createRootRoute({
  component: () => (
    <>
      <Header />
      <Outlet />
      <TanStackRouterDevtools />
      <TanStackQueryLayout />
    </>
  ),
})

// Home route - protected
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <AuthGuard>
      <App />
    </AuthGuard>
  ),
})

// Auth routes - public only (redirect to home if already logged in)
const authLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  component: () => (
    <PublicOnlyGuard>
      <Login />
    </PublicOnlyGuard>
  ),
})

const authRegisterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/register',
  component: () => (
    <PublicOnlyGuard>
      <Register />
    </PublicOnlyGuard>
  ),
})

// Helper function to wrap existing demo routes with AuthGuard
const wrapWithAuthGuard = (routeCreator: (parentRoute: any) => any) => {
  const originalRoute = routeCreator(rootRoute)
  const OriginalComponent = originalRoute.options.component

  return createRoute({
    getParentRoute: () => rootRoute,
    path: originalRoute.options.path,
    component: () => (
      <AuthGuard>
        <OriginalComponent />
      </AuthGuard>
    ),
  })
}

// Create all protected demo routes
const formSimpleRoute = wrapWithAuthGuard(FormSimpleDemo)
const formAddressRoute = wrapWithAuthGuard(FormAddressDemo)
const storeRoute = wrapWithAuthGuard(StoreDemo)
const tableRoute = wrapWithAuthGuard(TableDemo)
const tanStackQueryRoute = wrapWithAuthGuard(TanStackQueryDemo)

// Build the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  authLoginRoute,
  authRegisterRoute,
  formSimpleRoute,
  formAddressRoute,
  storeRoute,
  tableRoute,
  tanStackQueryRoute,
])

// Create and export the router
export const router = createRouter({
  routeTree,
  context: {
    ...TanStackQueryProvider.getContext(),
  },
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
})

// Register the router for TypeScript
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
