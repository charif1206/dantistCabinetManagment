import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { NavigationProvider } from './context/NavigationContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <NavigationProvider>
          <App />
        </NavigationProvider>
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>
)
