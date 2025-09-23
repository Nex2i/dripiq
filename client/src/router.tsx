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
import ConfirmationPage from './pages/auth/ConfirmationPage'
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
import TermsOfServicePage from './pages/TermsOfServicePage'
import NotFoundPage from './pages/NotFoundPage'
import UserEditPage from './pages/users/UserEditPage'
import UnsubscribePage from './pages/UnsubscribePage'

// Import layout components
import TanStackQueryLayout from './integrations/tanstack-query/layout'
import * as TanStackQueryProvider from './integrations/tanstack-query/root-provider'
import { AuthDebugMenu } from './components/AuthDebugMenu'
import { LEADS_URL } from './constants/navigation'

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

// Confirmation page route - public (shows button to redirect to password setup)
const confirmationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/confirm',
  component: () => <ConfirmationPage />,
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

// Terms of service route - public
const termsOfServiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terms-of-service',
  component: () => <TermsOfServicePage />,
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

// Protected index route - redirect to dashboard
const protectedIndexRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/',
  component: () => <Navigate to="/dashboard" replace />,
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

const leadsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: LEADS_URL,
  component: () => <LeadsPage />,
})

const newLeadRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: `${LEADS_URL}/new`,
  component: () => <NewLeadPage />,
})

const leadDetailRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: `${LEADS_URL}/$leadId`,
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
  component: () => <Navigate to="/settings/organization" replace />,
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
  protectedIndexRoute,
  dashboardRoute,
  profileRoute,
  leadsRoute,
  newLeadRoute,
  leadDetailRoute,
  settingsRouteTree,
])

const authRouteTree = authRoute.addChildren([authLoginRoute, authRegisterRoute])

// Build the route tree
const routeTree = rootRoute.addChildren([
  confirmationRoute,
  setupPasswordRoute,
  privacyPolicyRoute,
  termsOfServiceRoute,
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
