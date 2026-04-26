import { createRoute } from '@tanstack/react-router'

import AddressForm from '../pages/demo/demo.form.address'
import SimpleForm from '../pages/demo/demo.form.simple'
import TableDemo from '../pages/demo/demo.table'
import TanStackQueryDemo from '../pages/demo/demo.tanstack-query'

import type { RootRoute } from '@tanstack/react-router'

export const createDemoRoutes = (parentRoute: RootRoute) => {
  const addressFormRoute = createRoute({
    path: '/demo/form/address',
    component: AddressForm,
    getParentRoute: () => parentRoute,
  })

  const simpleFormRoute = createRoute({
    path: '/demo/form/simple',
    component: SimpleForm,
    getParentRoute: () => parentRoute,
  })

  const tableRoute = createRoute({
    path: '/demo/table',
    component: TableDemo,
    getParentRoute: () => parentRoute,
  })

  const tanStackQueryRoute = createRoute({
    path: '/demo/tanstack-query',
    component: TanStackQueryDemo,
    getParentRoute: () => parentRoute,
  })

  return {
    addressFormRoute,
    simpleFormRoute,
    tableRoute,
    tanStackQueryRoute,
  }
}
