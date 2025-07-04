import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'

import { router } from './router'
import { AuthProvider } from './contexts/AuthContext'
import * as TanStackQueryProvider from './integrations/tanstack-query/root-provider'

import './styles.css'
import reportWebVitals from './reportWebVitals'

const rootElement = document.getElementById('app')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <TanStackQueryProvider.Provider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </TanStackQueryProvider.Provider>
    </StrictMode>,
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
