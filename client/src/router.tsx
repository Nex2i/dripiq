import {
  Navigate,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

// Import components and pages
import Dashboard from './pages/Dashboard'
import Header from './components/Header'
import { AuthGuard, PublicOnlyGuard } from './components/AuthGuard'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import SetupPassword from './pages/auth/SetupPassword'
import LeadsPage from './pages/LeadsPage'
import NewLeadPage from './pages/NewLeadPage'
import LeadDetailPage from './pages/LeadDetailPage'
import SettingsLayout from './pages/settings/SettingsLayout'
import UsersPage from './pages/settings/UsersPage'
import NotificationsPage from './pages/settings/NotificationsPage'
import SecurityPage from './pages/settings/SecurityPage'
import BillingPage from './pages/settings/BillingPage'
import OrganizationPage from './pages/settings/OrganizationPage'
import ProductsPage from './pages/settings/ProductsPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import NotFoundPage from './pages/NotFoundPage'
import UserEditPage from './pages/users/UserEditPage'
import UnsubscribePage from './pages/UnsubscribePage'

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

// Home route - public (redirect to landing page)
const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => {
    // Redirect to the landing page URL
    window.location.href = import.meta.env.VITE_APP_URL
    return null
  },
})

// Setup password route - public (for invited users who don't have passwords yet)
const setupPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup-password',
  component: () => <SetupPassword />,
})

// Privacy policy route - public
const privacyPolicyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy-policy',
  component: () => <PrivacyPolicyPage />,
})

// Unsubscribe success route - public
const unsubscribeSuccessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/unsubscribe/success',
  component: () => <UnsubscribePage />,
  validateSearch: (search: Record<string, unknown>) => ({
    email: search.email as string | undefined,
  }),
})

// Dashboard route - protected
const dashboardRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/dashboard',
  component: () => <Dashboard />,
})

const profileRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/profile',
  component: () => <UserEditPage />,
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

const newLeadRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/leads/new',
  component: () => <NewLeadPage />,
})

const leadDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/leads/$leadId',
  component: () => <LeadDetailPage />,
})

// Settings routes with layout
const settingsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/settings',
  component: () => <SettingsLayout />,
})

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/',
  component: () => <Navigate to="/settings/organization" />,
})

const settingsUsersRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/users',
  component: () => <UsersPage />,
})

const settingsUserEditRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/users/$userId',
  component: () => <UserEditPage />,
})

const settingsNotificationsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/notifications',
  component: () => <NotificationsPage />,
})

const settingsSecurityRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/security',
  component: () => <SecurityPage />,
})

const settingsBillingRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/billing',
  component: () => <BillingPage />,
})

const settingsOrganizationRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/organization',
  component: () => <OrganizationPage />,
})

const settingsProductsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/products',
  component: () => <ProductsPage />,
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

// Catch-all 404 route
const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '$',
  component: () => <NotFoundPage />,
})

const settingsRouteTree = settingsRoute.addChildren([
  settingsIndexRoute,
  settingsUsersRoute,
  settingsUserEditRoute,
  settingsNotificationsRoute,
  settingsSecurityRoute,
  settingsBillingRoute,
  settingsOrganizationRoute,
  settingsProductsRoute,
])

const protectedRouteTree = protectedRoute.addChildren([
  dashboardRoute,
  profileRoute,
  leadsRoute,
  newLeadRoute,
  leadDetailRoute,
  settingsRouteTree,
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
  privacyPolicyRoute,
  unsubscribeSuccessRoute,
  protectedRouteTree,
  authRouteTree,
  notFoundRoute,
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
