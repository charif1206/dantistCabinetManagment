import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ToastProvider } from '@renderer/context/ToastContext'
import ToastContainer from '@renderer/features/common/ToastContainer'
import { NavigationProvider } from '@renderer/context/NavigationContext'
import { useNavigation } from '@renderer/context/useNavigation'
import { NewPatientModal } from '@renderer/features/patients/NewPatientModal'
import { EditPatientModal } from '@renderer/features/patients/EditPatientModal'
import { Patient } from '@shared/types'

const existingTestPatients: Patient[] = [
  {
    id: 'pat-existing-1',
    patientNumber: 'DZ-2026-0001',
    firstName: 'Amine',
    lastName: 'Mansouri',
    phone: '0550112233',
    cin: '1600112233',
    wilaya: '16 - Alger',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
]

// Navigation Spy component to inspect currentLocation after modal operations
const NavigationWatcher: React.FC = () => {
  const { currentLocation } = useNavigation()
  return (
    <div data-testid="nav-watcher">
      <span data-testid="nav-type">{currentLocation.type}</span>
      <span data-testid="nav-tab">{currentLocation.tab}</span>
      <span data-testid="nav-patient-name">
        {currentLocation.patient
          ? `${currentLocation.patient.firstName} ${currentLocation.patient.lastName}`
          : ''}
      </span>
      <span data-testid="nav-subtab">{currentLocation.patientSubTab || ''}</span>
    </div>
  )
}

interface TestWrapperProps {
  children: React.ReactNode
}

const TestWrapper: React.FC<TestWrapperProps> = ({ children }) => {
  return (
    <ToastProvider>
      <NavigationProvider>
        <NavigationWatcher />
        <ToastContainer />
        {children}
      </NavigationProvider>
    </ToastProvider>
  )
}

describe('Patient Modals & Forms Integration (NewPatientModal & EditPatientModal)', () => {
  let onCloseMock: ReturnType<typeof vi.fn>
  let onSuccessMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onCloseMock = vi.fn()
    onSuccessMock = vi.fn()
    vi.clearAllMocks()
  })

  describe('NewPatientModal Form & Field Validation', () => {
    it('validates fields on blur (onBlur): rejects invalid phone number and displays red error message below input', async () => {
      render(
        <TestWrapper>
          <NewPatientModal
            isOpen={true}
            onClose={onCloseMock}
            onSuccess={onSuccessMock}
            existingPatients={existingTestPatients}
          />
        </TestWrapper>
      )

      const phoneInput = screen.getByPlaceholderText('0550123456')
      expect(phoneInput).toBeInTheDocument()

      // Enter an invalid non-Algerian phone number (starts with 01)
      fireEvent.change(phoneInput, { target: { value: '0123456789' } })
      fireEvent.blur(phoneInput)

      // The red inline error message must appear
      const errorMsg = await screen.findByText(/Numéro de téléphone algérien invalide/i)
      expect(errorMsg).toBeInTheDocument()
      expect(phoneInput.className).toContain('border-error')

      // Now enter a valid phone number: the error should disappear
      fireEvent.change(phoneInput, { target: { value: '0550998877' } })
      fireEvent.blur(phoneInput)

      await waitFor(() => {
        expect(screen.queryByText(/Numéro de téléphone algérien invalide/i)).not.toBeInTheDocument()
      })
    })

    it('blocks submission with empty mandatory fields, renders field errors, and shows an error Toast', async () => {
      render(
        <TestWrapper>
          <NewPatientModal
            isOpen={true}
            onClose={onCloseMock}
            onSuccess={onSuccessMock}
            existingPatients={existingTestPatients}
          />
        </TestWrapper>
      )

      const firstNameInput = screen.getByPlaceholderText('Ex: Amine')
      const lastNameInput = screen.getByPlaceholderText('Ex: Mansouri')
      const phoneInput = screen.getByPlaceholderText('0550123456')

      // Clear all mandatory fields
      fireEvent.change(firstNameInput, { target: { value: '' } })
      fireEvent.change(lastNameInput, { target: { value: '' } })
      fireEvent.change(phoneInput, { target: { value: '' } })

      // Attempt to submit
      const submitBtn = screen.getByRole('button', { name: /enregistrer le patient/i })
      fireEvent.click(submitBtn)

      // Modal should NOT close
      expect(onCloseMock).not.toHaveBeenCalled()
      expect(onSuccessMock).not.toHaveBeenCalled()

      // Inline field errors must appear (and also shown in error toast)
      expect(screen.getAllByText(/Le champ "Prénom" est obligatoire/i).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(/Le champ "Nom" est obligatoire/i).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(/Le numéro de téléphone est requis/i).length).toBeGreaterThanOrEqual(1)

      // Error toast notification must be shown
      const toastAlert = await screen.findByRole('alert')
      expect(toastAlert).toBeInTheDocument()
      expect(toastAlert.className).toContain('red')
    })

    it('detects duplicate phone numbers against existing patients and blocks submission', async () => {
      render(
        <TestWrapper>
          <NewPatientModal
            isOpen={true}
            onClose={onCloseMock}
            onSuccess={onSuccessMock}
            existingPatients={existingTestPatients}
          />
        </TestWrapper>
      )

      const phoneInput = screen.getByPlaceholderText('0550123456')

      // Enter the phone number of the existing patient
      fireEvent.change(phoneInput, { target: { value: '0550112233' } })
      fireEvent.blur(phoneInput)

      // Expect contextual duplicate error message
      const dupError = await screen.findByText(/Ce numéro de téléphone est déjà associé au patient/i)
      expect(dupError).toBeInTheDocument()

      // Submit must be blocked
      const submitBtn = screen.getByRole('button', { name: /enregistrer le patient/i })
      fireEvent.click(submitBtn)

      expect(onCloseMock).not.toHaveBeenCalled()
      const toastAlert = await screen.findByRole('alert')
      expect(toastAlert).toHaveTextContent(/Ce numéro de téléphone est déjà associé au patient/i)
    })

    it('accepts valid Algerian patient data, saves patient, displays success toast, closes modal, and navigates to patient file', async () => {
      const createdPatient: Patient = {
        id: 'pat-new-99',
        patientNumber: 'DZ-2026-0099',
        firstName: 'Farid',
        lastName: 'Zidane',
        phone: '0661998877',
        cin: '1600998877',
        wilaya: '16 - Alger',
        bloodGroup: 'A+',
        medicalAlerts: 'Asthme modéré',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced'
      }

      // Mock savePatient
      window.api.savePatient = vi.fn().mockResolvedValue(createdPatient)

      render(
        <TestWrapper>
          <NewPatientModal
            isOpen={true}
            onClose={onCloseMock}
            onSuccess={onSuccessMock}
            existingPatients={existingTestPatients}
          />
        </TestWrapper>
      )

      // Fill in valid details
      fireEvent.change(screen.getByPlaceholderText('Ex: Amine'), { target: { value: 'Farid' } })
      fireEvent.change(screen.getByPlaceholderText('Ex: Mansouri'), { target: { value: 'Zidane' } })
      fireEvent.change(screen.getByPlaceholderText('0550123456'), { target: { value: '0661998877' } })
      fireEvent.change(screen.getByPlaceholderText('Ex: 1092837465'), { target: { value: '1600998877' } })

      // Submit
      const submitBtn = screen.getByRole('button', { name: /enregistrer le patient/i })
      fireEvent.click(submitBtn)

      // Verify save API call
      await waitFor(() => {
        expect(window.api.savePatient).toHaveBeenCalledWith(
          expect.objectContaining({
            firstName: 'Farid',
            lastName: 'Zidane',
            phone: '0661998877',
            cin: '1600998877'
          })
        )
      })

      // Modal closed and success callback fired
      expect(onCloseMock).toHaveBeenCalled()
      expect(onSuccessMock).toHaveBeenCalledWith(createdPatient)

      // Success Toast rendered
      const successToast = await screen.findByRole('alert')
      expect(successToast).toHaveTextContent(/Dossier patient créé avec succès pour Farid Zidane/i)

      // Navigation redirected to patient file ('overview')
      expect(screen.getByTestId('nav-type').textContent).toBe('patient')
      expect(screen.getByTestId('nav-patient-name').textContent).toBe('Farid Zidane')
      expect(screen.getByTestId('nav-subtab').textContent).toBe('overview')
    })
  })

  describe('EditPatientModal Updates', () => {
    it('loads existing patient details, updates them, and shows success notification', async () => {
      const patientToEdit: Patient = {
        id: 'pat-edit-1',
        patientNumber: 'DZ-2026-0005',
        firstName: 'Youcef',
        lastName: 'Belaili',
        phone: '0555332211',
        cin: '3100554433',
        wilaya: '31 - Oran',
        bloodGroup: 'B+',
        notes: 'Ancien dossier',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      }

      const updatedPatient: Patient = {
        ...patientToEdit,
        lastName: 'Belaili Amir',
        phone: '0555332299',
        updatedAt: new Date().toISOString()
      }

      window.api.savePatient = vi.fn().mockResolvedValue(updatedPatient)

      render(
        <TestWrapper>
          <EditPatientModal
            isOpen={true}
            patient={patientToEdit}
            onClose={onCloseMock}
            onSuccess={onSuccessMock}
            existingPatients={existingTestPatients}
          />
        </TestWrapper>
      )

      // Inputs should have existing values
      const lastNameInput = screen.getByDisplayValue('Belaili')
      expect(lastNameInput).toBeInTheDocument()

      const phoneInput = screen.getByDisplayValue('0555332211')
      expect(phoneInput).toBeInTheDocument()

      // Change values
      fireEvent.change(lastNameInput, { target: { value: 'Belaili Amir' } })
      fireEvent.change(phoneInput, { target: { value: '0555332299' } })

      // Submit
      const submitBtn = screen.getByRole('button', { name: /enregistrer les modifications/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(window.api.savePatient).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'pat-edit-1',
            lastName: 'Belaili Amir',
            phone: '0555332299'
          })
        )
      })

      expect(onCloseMock).toHaveBeenCalled()
      expect(onSuccessMock).toHaveBeenCalledWith(updatedPatient)

      const successToast = await screen.findByRole('alert')
      expect(successToast).toHaveTextContent(/mises à jour avec succès/i)
    })
  })
})
