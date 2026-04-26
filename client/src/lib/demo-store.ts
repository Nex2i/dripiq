import { createAtom, Store } from '@tanstack/store'

export const store = new Store({
  firstName: 'Jane',
  lastName: 'Smith',
})

export const fullName = createAtom(
  () => `${store.state.firstName} ${store.state.lastName}`,
)
