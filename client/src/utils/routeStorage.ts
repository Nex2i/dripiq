const PREVIOUS_ROUTE_KEY = 'previousRoute'

/**
 * Store the current route in localStorage so it can be restored after login
 * Uses localStorage instead of sessionStorage to persist across browser sessions
 */
export function storePreviousRoute(): void {
  const currentPath = window.location.pathname
  // Don't store auth routes as previous routes since we don't want to redirect back to login/register
  if (
    !currentPath.startsWith('/auth') &&
    currentPath !== '/login' &&
    currentPath !== '/register'
  ) {
    localStorage.setItem(PREVIOUS_ROUTE_KEY, currentPath)
  }
}

/**
 * Get the stored previous route from localStorage
 */
export function getStoredPreviousRoute(): string | null {
  return localStorage.getItem(PREVIOUS_ROUTE_KEY)
}

/**
 * Clear the stored previous route from localStorage
 */
export function clearStoredPreviousRoute(): void {
  localStorage.removeItem(PREVIOUS_ROUTE_KEY)
}
