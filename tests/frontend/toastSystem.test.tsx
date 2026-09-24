import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider, useToast } from '@renderer/context/ToastContext'
import ToastContainer from '@renderer/features/common/ToastContainer'

// Helper component that exposes toast triggers for testing
const TestConsumer: React.FC = () => {
  const toast = useToast()

  return (
    <div>
      <button onClick={() => toast.success('Patient enregistré avec succès', 'Succès')}>
        Trigger Success
      </button>
      <button onClick={() => toast.error('Échec de la sauvegarde', 'Erreur')}>
        Trigger Error
      </button>
      <button onClick={() => toast.warning('Attention : conflit d’horaire', 'Attention')}>
        Trigger Warning
      </button>
      <button onClick={() => toast.info('Synchronisation terminée', 'Information')}>
        Trigger Info
      </button>
      <button onClick={() => toast.showToast('Message personnalisé', 'info', 4000)}>
        Trigger Custom
      </button>
    </div>
  )
}

const renderToastApp = () => {
  return render(
    <ToastProvider>
      <TestConsumer />
      <ToastContainer />
    </ToastProvider>
  )
}

describe('Toast Notification System - DentaFlow Algeria', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders all 4 toast types (success, error, warning, info) with corresponding styling and badges', () => {
    renderToastApp()

    // 1. Success Toast (Green theme)
    fireEvent.click(screen.getByRole('button', { name: /trigger success/i }))
    const successToast = screen.getByRole('alert')
    expect(successToast).toBeInTheDocument()
    expect(screen.getByText('Succès')).toBeInTheDocument()
    expect(screen.getByText('Patient enregistré avec succès')).toBeInTheDocument()
    expect(successToast.className).toContain('emerald')

    // 2. Error Toast (Red theme)
    fireEvent.click(screen.getByRole('button', { name: /trigger error/i }))
    expect(screen.getByText('Erreur')).toBeInTheDocument()
    expect(screen.getByText('Échec de la sauvegarde')).toBeInTheDocument()
    const allAlertsAfterError = screen.getAllByRole('alert')
    expect(allAlertsAfterError.some((el) => el.className.includes('red'))).toBe(true)

    // 3. Warning Toast (Amber / Orange theme)
    fireEvent.click(screen.getByRole('button', { name: /trigger warning/i }))
    expect(screen.getByText('Attention')).toBeInTheDocument()
    expect(screen.getByText('Attention : conflit d’horaire')).toBeInTheDocument()
    const allAlertsAfterWarning = screen.getAllByRole('alert')
    expect(allAlertsAfterWarning.some((el) => el.className.includes('amber'))).toBe(true)

    // 4. Info Toast (Blue theme)
    fireEvent.click(screen.getByRole('button', { name: /trigger info/i }))
    expect(screen.getByText('Information')).toBeInTheDocument()
    expect(screen.getByText('Synchronisation terminée')).toBeInTheDocument()
    const allAlertsAfterInfo = screen.getAllByRole('alert')
    expect(allAlertsAfterInfo.some((el) => el.className.includes('blue'))).toBe(true)
  })

  it('automatically dismisses toasts after 4 seconds (4000ms duration + exit animation)', () => {
    renderToastApp()

    fireEvent.click(screen.getByRole('button', { name: /trigger success/i }))
    expect(screen.getByText('Patient enregistré avec succès')).toBeInTheDocument()

    // Fast-forward 2 seconds: toast must still be visible
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('Patient enregistré avec succès')).toBeInTheDocument()

    // Fast-forward through remaining duration (2000ms) + exit animation (250ms)
    act(() => {
      vi.advanceTimersByTime(2300)
    })

    expect(screen.queryByText('Patient enregistré avec succès')).not.toBeInTheDocument()
  })

  it('manually closes toast immediately when clicking the close button', () => {
    renderToastApp()

    fireEvent.click(screen.getByRole('button', { name: /trigger error/i }))
    expect(screen.getByText('Échec de la sauvegarde')).toBeInTheDocument()

    const closeBtn = screen.getByRole('button', { name: /fermer/i })
    expect(closeBtn).toBeInTheDocument()

    // Click close
    act(() => {
      fireEvent.click(closeBtn)
    })

    // Advance 250ms for closing transition animation
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.queryByText('Échec de la sauvegarde')).not.toBeInTheDocument()
  })

  it('manages multiple concurrent toasts independently', () => {
    renderToastApp()

    fireEvent.click(screen.getByRole('button', { name: /trigger success/i }))
    fireEvent.click(screen.getByRole('button', { name: /trigger info/i }))

    expect(screen.getAllByRole('alert')).toHaveLength(2)
    expect(screen.getByText('Patient enregistré avec succès')).toBeInTheDocument()
    expect(screen.getByText('Synchronisation terminée')).toBeInTheDocument()

    // Close only the first one
    const closeButtons = screen.getAllByRole('button', { name: /fermer/i })
    act(() => {
      fireEvent.click(closeButtons[0])
      vi.advanceTimersByTime(300)
    })

    expect(screen.queryByText('Patient enregistré avec succès')).not.toBeInTheDocument()
    expect(screen.getByText('Synchronisation terminée')).toBeInTheDocument()
  })
})
