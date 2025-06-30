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

// Import demo components directly
import FormSimpleDemo from './pages/demo/demo.form.simple'
import FormAddressDemo from './pages/demo/demo.form.address'
import StoreDemo from './pages/demo/demo.store'
import TableDemo from './pages/demo/demo.table'
import TanStackQueryDemo from './pages/demo/demo.tanstack-query'

// Import layout components
import TanStackQueryLayout from './integrations/tanstack-query/layout'
import * as TanStackQueryProvider from './integrations/tanstack-query/root-provider'

// Root route with header
const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  component: () => (
    <AuthGuard>
      <Header />
      <Outlet />
      <TanStackRouterDevtools />
      <TanStackQueryLayout />
    </AuthGuard>
  ),
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth',
  component: () => (
    <>
      <PublicOnlyGuard>
        <Outlet />
      </PublicOnlyGuard>
      <TanStackRouterDevtools />
      <TanStackQueryLayout />
    </>
  ),
})

// Home route - protected
const indexRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/',
  component: () => <App />,
})

// Auth routes - public only (redirect to home if already logged in)
const authLoginRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/login',
  component: () => <Login />,
})

const authRegisterRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/register',
  component: () => <Register />,
})

// Create all protected demo routes directly
const formSimpleRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/demo/form/simple',
  component: () => <FormSimpleDemo />,
})

const formAddressRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/demo/form/address',
  component: () => <FormAddressDemo />,
})

const storeRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/demo/store',
  component: () => <StoreDemo />,
})

const tableRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/demo/table',
  component: () => <TableDemo />,
})

const tanStackQueryRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/demo/tanstack-query',
  component: () => <TanStackQueryDemo />,
})

const protectedRouteTree = protectedRoute.addChildren([
  indexRoute,
  formSimpleRoute,
  formAddressRoute,
  storeRoute,
  tableRoute,
  tanStackQueryRoute,
])

const authRouteTree = authRoute.addChildren([authLoginRoute, authRegisterRoute])

// Build the route tree
const routeTree = rootRoute.addChildren([protectedRouteTree, authRouteTree])

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
