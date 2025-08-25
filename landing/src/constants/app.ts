// Central configuration for app URLs
const APP_BASE_URL = import.meta.env.VITE_APP_URL || 'https://app.dripiq.ai'

export const APP_URLS = {
  BASE: APP_BASE_URL,
  LOGIN: `${APP_BASE_URL}/auth/login`,
  SIGNUP: `${APP_BASE_URL}/auth/register`,
  SIGNUP_PRO: `${APP_BASE_URL}/auth/register?plan=pro`,
} as const

export default APP_URLS
