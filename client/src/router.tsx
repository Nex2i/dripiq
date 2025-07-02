import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

// Import components and pages
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import Header from './components/Header'
import { AuthGuard, PublicOnlyGuard } from './components/AuthGuard'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import SetupPassword from './pages/auth/SetupPassword'
import LeadsPage from './pages/LeadsPage'
import UsersPage from './pages/settings/UsersPage'

// Import demo components directly
import FormSimpleDemo from './pages/demo/demo.form.simple'
import FormAddressDemo from './pages/demo/demo.form.address'
import StoreDemo from './pages/demo/demo.store'
import TableDemo from './pages/demo/demo.table'
import TanStackQueryDemo from './pages/demo/demo.tanstack-query'

// Import layout components
import TanStackQueryLayout from './integrations/tanstack-query/layout'
import * as TanStackQueryProvider from './integrations/tanstack-query/root-provider'
import { AuthDebugMenu } from './components/AuthDebugMenu'

// Root route with header
const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <TanStackRouterDevtools />
      <TanStackQueryLayout />
      <AuthDebugMenu />
    </>
  ),
})

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  component: () => (
    <>
      <AuthGuard>
        <Header />
        <Outlet />
      </AuthGuard>
    </>
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

// Landing page route - public
const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <LandingPage />,
})

// Setup password route - public (for invited users who don't have passwords yet)
const setupPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup-password',
  component: () => <SetupPassword />,
})

// Dashboard route - protected
const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/dashboard',
  component: () => <Dashboard />,
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

const authSetupPasswordRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/setup-password',
  component: () => <SetupPassword />,
})

const leadsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/leads',
  component: () => <LeadsPage />,
})

const usersRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/settings/users',
  component: () => <UsersPage />,
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
  dashboardRoute,
  leadsRoute,
  usersRoute,
  formSimpleRoute,
  formAddressRoute,
  storeRoute,
  tableRoute,
  tanStackQueryRoute,
])

const authRouteTree = authRoute.addChildren([
  authLoginRoute,
  authRegisterRoute,
  authSetupPasswordRoute,
])

// Build the route tree
const routeTree = rootRoute.addChildren([
  landingRoute,
  setupPasswordRoute,
  protectedRouteTree,
  authRouteTree,
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
