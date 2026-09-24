import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'

export default function LoginView(): JSX.Element {
  const { login } = useAuth()
  const [username, setUsername] = useState('dr_amrani')
  const [password, setPassword] = useState('dentist123')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const result = await login(username, password)
      if (!result.success) {
        setErrorMessage(result.error || 'Identifiants invalides. Veuillez vérifier votre nom d’utilisateur et mot de passe.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Quick switch for clinic staff testing
  const selectQuickProfile = (u: string, p: string): void => {
    setUsername(u)
    setPassword(p)
    setErrorMessage(null)
  }

  return (
    <div className="bg-surface min-h-screen flex items-center justify-center p-4 selection:bg-secondary-container selection:text-on-secondary-container">
      <main className="w-full max-w-[440px]">
        {/* Login Card (Pure Tailwind matching Stitch Design) */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl p-8 transition-all">
          {/* Brand Header */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary-container text-primary-fixed flex items-center justify-center font-bold text-2xl shadow-xs mb-3">
              <span className="material-symbols-outlined text-3xl text-secondary-container">dentistry</span>
            </div>
            <h1 className="font-bold text-2xl tracking-tight text-primary-container">DentaFlow</h1>
            <p className="text-xs font-medium text-on-surface-variant mt-1 text-center">
              Cabinet Dentaire Algérie · Gestion Clinique
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div
              className="bg-error-container text-error p-3.5 rounded-xl flex items-start gap-2.5 mb-5 border border-error/30 animate-in fade-in duration-200"
              role="alert"
            >
              <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">warning</span>
              <p className="text-xs font-medium leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1.5" htmlFor="username">
                Nom d'utilisateur / Identifiant
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-xl">
                  person
                </span>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex: dr_amrani"
                  className="w-full h-11 pl-11 pr-4 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm text-on-surface transition-colors placeholder:text-outline"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-on-surface" htmlFor="password">
                  Mot de passe
                </label>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-xl">
                  lock
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-11 pr-11 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm text-on-surface tracking-wide transition-colors placeholder:text-outline"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-1 transition-colors"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-lg">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Quick Demo Switcher for fast testing in the clinic */}
            <div className="pt-1">
              <span className="text-[11px] font-semibold text-on-surface-variant block mb-1.5">
                Comptes de test rapide :
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => selectQuickProfile('dr_amrani', 'dentist123')}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all text-left flex items-center gap-1.5 ${
                    username === 'dr_amrani'
                      ? 'border-secondary bg-secondary-fixed/50 text-on-secondary-container font-semibold'
                      : 'border-outline-variant/60 hover:bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm text-secondary">stethoscope</span>
                  <span>Dr. Amrani</span>
                </button>
                <button
                  type="button"
                  onClick={() => selectQuickProfile('admin', 'admin123')}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all text-left flex items-center gap-1.5 ${
                    username === 'admin'
                      ? 'border-secondary bg-secondary-fixed/50 text-on-secondary-container font-semibold'
                      : 'border-outline-variant/60 hover:bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm text-secondary">admin_panel_settings</span>
                  <span>Admin</span>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 flex items-center justify-center bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary rounded-xl text-sm font-semibold transition-all shadow-xs disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                    <span>Connexion en cours...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span>Accéder au Cabinet</span>
                    <span className="material-symbols-outlined text-lg">login</span>
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-5 text-center space-y-1">
          <p className="text-[11px] font-mono text-outline">DentaFlow v4.2.1 · Licence Cabinet Algérie</p>
          <p className="text-[10px] text-outline/80">Base locale SQLite chiffrée (Offline-First)</p>
        </div>
      </main>
    </div>
  )
}
