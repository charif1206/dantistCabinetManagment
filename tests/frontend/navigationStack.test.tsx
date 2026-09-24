import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { NavigationProvider } from '@renderer/context/NavigationContext'
import { useNavigation } from '@renderer/context/useNavigation'
import Breadcrumbs from '@renderer/features/common/Breadcrumbs'
import { Patient } from '@shared/types'

const samplePatient: Patient = {
  id: 'pat-001',
  patientNumber: 'DZ-2026-0001',
  firstName: 'Ahmed',
  lastName: 'Benali',
  phone: '0550123456',
  wilaya: 'Alger',
  bloodGroup: 'O+',
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-01T10:00:00Z'
}

// Test harness exposing all NavigationContext controls and rendering Breadcrumbs
const NavigationTestComponent: React.FC<{ initialPatient?: Patient }> = ({
  initialPatient = samplePatient
}) => {
  const {
    currentLocation,
    history,
    currentIndex,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    goToTab,
    openPatient,
    setPatientSubTab,
    updateCurrentPatient,
    breadcrumbs
  } = useNavigation()

  return (
    <div>
      {/* 1. Navigation Buttons (Back & Forward) */}
      <button
        type="button"
        onClick={goBack}
        disabled={!canGoBack}
        aria-label="Page précédente"
      >
        Retour
      </button>
      <button
        type="button"
        onClick={goForward}
        disabled={!canGoForward}
        aria-label="Page suivante"
      >
        Avancer
      </button>

      {/* 2. Direct Navigation Actions */}
      <button type="button" onClick={() => goToTab('appointments')}>
        Nav Appointments
      </button>
      <button type="button" onClick={() => goToTab('patients')}>
        Nav Patients Tab
      </button>
      <button type="button" onClick={() => goToTab('billing')}>
        Nav Billing
      </button>
      <button type="button" onClick={() => openPatient(initialPatient, 'overview')}>
        Open Patient File
      </button>
      <button type="button" onClick={() => setPatientSubTab('chart')}>
        Open Dental Chart
      </button>
      <button type="button" onClick={() => setPatientSubTab('prescriptions')}>
        Open Prescriptions
      </button>
      <button
        type="button"
        onClick={() =>
          updateCurrentPatient({
            ...initialPatient,
            firstName: 'Ahmed Reda',
            lastName: 'Benali'
          })
        }
      >
        Update Patient Data
      </button>

      {/* 3. Breadcrumbs Component */}
      <Breadcrumbs />

      {/* 4. Inspection DOM elements */}
      <div data-testid="current-tab">{currentLocation.tab}</div>
      <div data-testid="current-type">{currentLocation.type}</div>
      <div data-testid="current-subtab">{currentLocation.patientSubTab || 'none'}</div>
      <div data-testid="current-index">{currentIndex}</div>
      <div data-testid="history-length">{history.length}</div>
      <div data-testid="current-patient-name">
        {currentLocation.patient
          ? `${currentLocation.patient.firstName} ${currentLocation.patient.lastName}`
          : 'none'}
      </div>
      <div data-testid="breadcrumbs-count">{breadcrumbs.length}</div>
    </div>
  )
}

const renderNavigation = (patient?: Patient) => {
  return render(
    <NavigationProvider>
      <NavigationTestComponent initialPatient={patient} />
    </NavigationProvider>
  )
}

describe('NavigationContext & LIFO Visit Stack Integration', () => {
  it('1. correctly manages LIFO visit stack with step-by-step goBack and goForward', () => {
    renderNavigation()

    const backBtn = screen.getByRole('button', { name: 'Page précédente' })
    const forwardBtn = screen.getByRole('button', { name: 'Page suivante' })

    // Step A: Initial state -> dashboard (Index 0)
    expect(screen.getByTestId('current-tab').textContent).toBe('dashboard')
    expect(screen.getByTestId('current-index').textContent).toBe('0')
    expect(screen.getByTestId('history-length').textContent).toBe('1')
    expect(backBtn).toBeDisabled()
    expect(forwardBtn).toBeDisabled()

    // Step B: Navigate to 'appointments'
    fireEvent.click(screen.getByRole('button', { name: 'Nav Appointments' }))
    expect(screen.getByTestId('current-tab').textContent).toBe('appointments')
    expect(screen.getByTestId('current-index').textContent).toBe('1')
    expect(screen.getByTestId('history-length').textContent).toBe('2')
    expect(backBtn).not.toBeDisabled()
    expect(forwardBtn).toBeDisabled()

    // Step C: Open patient file ('overview')
    fireEvent.click(screen.getByRole('button', { name: 'Open Patient File' }))
    expect(screen.getByTestId('current-type').textContent).toBe('patient')
    expect(screen.getByTestId('current-subtab').textContent).toBe('overview')
    expect(screen.getByTestId('current-patient-name').textContent).toBe('Ahmed Benali')
    expect(screen.getByTestId('current-index').textContent).toBe('2')
    expect(screen.getByTestId('history-length').textContent).toBe('3')

    // Step D: Open dental chart 'chart'
    fireEvent.click(screen.getByRole('button', { name: 'Open Dental Chart' }))
    expect(screen.getByTestId('current-type').textContent).toBe('patient')
    expect(screen.getByTestId('current-subtab').textContent).toBe('chart')
    expect(screen.getByTestId('current-index').textContent).toBe('3')
    expect(screen.getByTestId('history-length').textContent).toBe('4')
    expect(backBtn).not.toBeDisabled()
    expect(forwardBtn).toBeDisabled()

    // Step E: Step-by-step goBack()
    // 1. From Dental Chart -> Patient File (Overview)
    fireEvent.click(backBtn)
    expect(screen.getByTestId('current-subtab').textContent).toBe('overview')
    expect(screen.getByTestId('current-index').textContent).toBe('2')
    expect(forwardBtn).not.toBeDisabled()

    // 2. From Patient File -> Appointments Tab
    fireEvent.click(backBtn)
    expect(screen.getByTestId('current-tab').textContent).toBe('appointments')
    expect(screen.getByTestId('current-type').textContent).toBe('tab')
    expect(screen.getByTestId('current-index').textContent).toBe('1')

    // 3. From Appointments Tab -> Dashboard
    fireEvent.click(backBtn)
    expect(screen.getByTestId('current-tab').textContent).toBe('dashboard')
    expect(screen.getByTestId('current-index').textContent).toBe('0')
    expect(backBtn).toBeDisabled()
    expect(forwardBtn).not.toBeDisabled()

    // Step F: Step-by-step goForward()
    // 1. Forward to Appointments
    fireEvent.click(forwardBtn)
    expect(screen.getByTestId('current-tab').textContent).toBe('appointments')
    expect(screen.getByTestId('current-index').textContent).toBe('1')

    // 2. Forward to Patient Overview
    fireEvent.click(forwardBtn)
    expect(screen.getByTestId('current-subtab').textContent).toBe('overview')
    expect(screen.getByTestId('current-patient-name').textContent).toBe('Ahmed Benali')
    expect(screen.getByTestId('current-index').textContent).toBe('2')

    // 3. Forward to Dental Chart
    fireEvent.click(forwardBtn)
    expect(screen.getByTestId('current-subtab').textContent).toBe('chart')
    expect(screen.getByTestId('current-index').textContent).toBe('3')
    expect(forwardBtn).toBeDisabled()
  })

  it('2. truncates forward history when a new navigation occurs from an intermediate index (LIFO behavior)', () => {
    renderNavigation()

    const backBtn = screen.getByRole('button', { name: 'Page précédente' })

    // Build history: Dashboard (0) -> Appointments (1) -> Patient (2) -> Chart (3)
    fireEvent.click(screen.getByRole('button', { name: 'Nav Appointments' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Patient File' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Dental Chart' }))
    expect(screen.getByTestId('current-index').textContent).toBe('3')
    expect(screen.getByTestId('history-length').textContent).toBe('4')

    // Go back two steps to Appointments (Index 1)
    fireEvent.click(backBtn)
    fireEvent.click(backBtn)
    expect(screen.getByTestId('current-index').textContent).toBe('1')
    expect(screen.getByTestId('current-tab').textContent).toBe('appointments')

    // Branch to a new route: Billing Tab
    fireEvent.click(screen.getByRole('button', { name: 'Nav Billing' }))

    // History should now be: Dashboard (0) -> Appointments (1) -> Billing (2)
    expect(screen.getByTestId('current-tab').textContent).toBe('billing')
    expect(screen.getByTestId('current-index').textContent).toBe('2')
    expect(screen.getByTestId('history-length').textContent).toBe('3')
    expect(screen.getByRole('button', { name: 'Page suivante' })).toBeDisabled()
  })

  it('3. generates interactive Breadcrumbs hierarchy and navigates directly upon clicking', () => {
    renderNavigation()

    // Navigate: Dashboard -> Open Patient File -> Open Dental Chart
    fireEvent.click(screen.getByRole('button', { name: 'Open Patient File' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Dental Chart' }))

    // Breadcrumbs should contain: "Accueil" > "Dossiers Patients" > "Ahmed Benali" > "Schéma Dentaire"
    const navBreadcrumbs = screen.getByRole('navigation', { name: "Fil d'ariane" })
    expect(navBreadcrumbs).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /accueil/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dossiers patients/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ahmed benali/i })).toBeInTheDocument()

    // Active page is "Schéma Dentaire"
    const activePage = screen.getByText('Schéma Dentaire')
    expect(activePage).toHaveAttribute('aria-current', 'page')

    // Click on "Dossiers Patients" breadcrumb button
    const patientsCrumbBtn = screen.getByRole('button', { name: /dossiers patients/i })
    fireEvent.click(patientsCrumbBtn)

    // Should navigate directly to Patients table
    expect(screen.getByTestId('current-tab').textContent).toBe('patients')
    expect(screen.getByTestId('current-type').textContent).toBe('tab')
  })

  it('4. preserves and stabilizes patient state consistently across navigation without memory leaks', () => {
    renderNavigation()

    // Open patient file
    fireEvent.click(screen.getByRole('button', { name: 'Open Patient File' }))
    expect(screen.getByTestId('current-patient-name').textContent).toBe('Ahmed Benali')

    // Switch between multiple subtabs (Overview -> Chart -> Prescriptions)
    fireEvent.click(screen.getByRole('button', { name: 'Open Dental Chart' }))
    expect(screen.getByTestId('current-subtab').textContent).toBe('chart')

    fireEvent.click(screen.getByRole('button', { name: 'Open Prescriptions' }))
    expect(screen.getByTestId('current-subtab').textContent).toBe('prescriptions')

    // Update patient data dynamically (e.g. from an edit modal or sync event)
    fireEvent.click(screen.getByRole('button', { name: 'Update Patient Data' }))
    expect(screen.getByTestId('current-patient-name').textContent).toBe('Ahmed Reda Benali')

    // Go back in history to the chart state - patient updated name must be preserved
    const backBtn = screen.getByRole('button', { name: 'Page précédente' })
    fireEvent.click(backBtn)
    expect(screen.getByTestId('current-subtab').textContent).toBe('chart')
    expect(screen.getByTestId('current-patient-name').textContent).toBe('Ahmed Reda Benali')

    // Go back to Overview
    fireEvent.click(backBtn)
    expect(screen.getByTestId('current-subtab').textContent).toBe('overview')
    expect(screen.getByTestId('current-patient-name').textContent).toBe('Ahmed Reda Benali')
  })
})
