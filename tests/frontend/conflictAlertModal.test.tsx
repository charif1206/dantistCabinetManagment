import React, { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ToastProvider } from '@renderer/context/ToastContext'
import ToastContainer from '@renderer/features/common/ToastContainer'
import ConflictAlertModal from '@renderer/features/planning/ConflictAlertModal'
import NewAppointmentDrawer from '@renderer/features/planning/NewAppointmentDrawer'
import { Appointment, Patient } from '@shared/types'

const sampleConflictingAppointment: Appointment = {
  id: 'apt-conflict-101',
  patientId: 'pat-101',
  patientName: 'Kamel Madani',
  patientPhone: '0555112233',
  dateTime: '2026-10-25T10:00:00',
  durationMinutes: 30, // 10:00 to 10:30
  treatmentType: 'Traitement Endodontique',
  status: 'CONFIRMED',
  dentistName: 'Dr. Mohamed Amrani',
  notes: 'Dévitalisation molaire 16'
}

const sampleLateEveningAppointment: Appointment = {
  id: 'apt-late-102',
  patientId: 'pat-102',
  patientName: 'Samira Belkacem',
  patientPhone: '0666223344',
  dateTime: '2026-10-25T21:45:00',
  durationMinutes: 30, // Ends at 22:15, after evening shift
  treatmentType: 'Urgence dentaire (Douleur)',
  status: 'CONFIRMED',
  dentistName: 'Dr. Mohamed Amrani'
}

const samplePatient: Patient = {
  id: 'pat-cal-101',
  patientNumber: 'DZ-2026-0042',
  firstName: 'Farid',
  lastName: 'Zidane',
  phone: '0550123456',
  wilaya: '16 - Alger',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
}

describe('ConflictAlertModal & Conflict Detection UI Integration Tests', () => {
  // =========================================================================
  // 1. عرض نافذة التنبيه ومكونات تفاصيل التعارض
  // =========================================================================
  describe('1. ConflictAlertModal Display & Details Card', () => {
    it('renders the conflict modal with warning banner, practitioner name and overlapping appointment details', () => {
      const onForceSave = vi.fn()
      const onModifyTime = vi.fn()
      const onCancel = vi.fn()
      const onAcceptSuggestedTime = vi.fn()

      render(
        <ConflictAlertModal
          conflictingAppointment={sampleConflictingAppointment}
          newTime="2026-10-25T10:15"
          onForceSave={onForceSave}
          onModifyTime={onModifyTime}
          onCancel={onCancel}
          onAcceptSuggestedTime={onAcceptSuggestedTime}
        />
      )

      // Warning Title & Subtitle
      expect(screen.getByText("Conflit d'horaire détecté")).toBeInTheDocument()
      expect(screen.getAllByText(/Dr\. Mohamed Amrani/).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/est déjà occupé sur ce créneau horaire/i)).toBeInTheDocument()

      // Conflicting Patient Card Info
      expect(screen.getByText('Rendez-vous existant en chevauchement :')).toBeInTheDocument()
      expect(screen.getByText('Kamel Madani')).toBeInTheDocument()
      expect(screen.getByText('Traitement Endodontique')).toBeInTheDocument()
      expect(screen.getByText(/30 min/)).toBeInTheDocument()
    })

    it('calculates and displays alternative slot immediately after conflicting appointment ends (10:00 + 30 min = 10:30)', () => {
      render(
        <ConflictAlertModal
          conflictingAppointment={sampleConflictingAppointment}
          newTime="2026-10-25T10:15"
          onForceSave={vi.fn()}
          onModifyTime={vi.fn()}
          onCancel={vi.fn()}
          onAcceptSuggestedTime={vi.fn()}
        />
      )

      // Alternative slot section
      expect(screen.getByText('Créneau alternatif disponible :')).toBeInTheDocument()
      expect(screen.getByText(/Dès la fin de la séance à/i)).toBeInTheDocument()
      expect(screen.getAllByText(/10:30/).length).toBeGreaterThanOrEqual(1)

      // Button to pick alternative slot
      const chooseAltBtn = screen.getByRole('button', {
        name: /Choisir.*10:30/i
      })
      expect(chooseAltBtn).toBeInTheDocument()
    })

    it('rolls over alternative slot to next morning at 08:00 when appointment ends past 22:00', () => {
      render(
        <ConflictAlertModal
          conflictingAppointment={sampleLateEveningAppointment}
          newTime="2026-10-25T21:50"
          onForceSave={vi.fn()}
          onModifyTime={vi.fn()}
          onCancel={vi.fn()}
          onAcceptSuggestedTime={vi.fn()}
        />
      )

      // Displays next morning
      expect(screen.getAllByText(/Demain à 08:00/i).length).toBeGreaterThanOrEqual(1)

      const chooseAltBtn = screen.getByRole('button', {
        name: /Choisir.*Demain à 08:00/i
      })
      expect(chooseAltBtn).toBeInTheDocument()
    })
  })

  // =========================================================================
  // 2. اختبار النقر على خيار "Choisir le créneau alternatif" والإجراءات
  // =========================================================================
  describe('2. Modal Action Buttons & Alternative Slot Selection', () => {
    it('triggers onAcceptSuggestedTime with formatted ISO string when clicking "Choisir le créneau alternatif"', () => {
      const onAcceptSuggestedTime = vi.fn()

      render(
        <ConflictAlertModal
          conflictingAppointment={sampleConflictingAppointment}
          newTime="2026-10-25T10:15"
          onForceSave={vi.fn()}
          onModifyTime={vi.fn()}
          onCancel={vi.fn()}
          onAcceptSuggestedTime={onAcceptSuggestedTime}
        />
      )

      const chooseAltBtn = screen.getByRole('button', {
        name: /Choisir.*10:30/i
      })
      fireEvent.click(chooseAltBtn)

      // Must receive the computed ISO for 10:30
      expect(onAcceptSuggestedTime).toHaveBeenCalledTimes(1)
      expect(onAcceptSuggestedTime).toHaveBeenCalledWith('2026-10-25T10:30')
    })

    it('triggers onForceSave when clicking "Forcer le créneau"', () => {
      const onForceSave = vi.fn()

      render(
        <ConflictAlertModal
          conflictingAppointment={sampleConflictingAppointment}
          newTime="2026-10-25T10:15"
          onForceSave={onForceSave}
          onModifyTime={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      const forceBtn = screen.getByRole('button', { name: /Réserver sur un Fauteuil Libre|Forcer/i })
      fireEvent.click(forceBtn)

      expect(onForceSave).toHaveBeenCalledTimes(1)
    })

    it('triggers onModifyTime when clicking "Changer l\'heure"', () => {
      const onModifyTime = vi.fn()

      render(
        <ConflictAlertModal
          conflictingAppointment={sampleConflictingAppointment}
          newTime="2026-10-25T10:15"
          onForceSave={vi.fn()}
          onModifyTime={onModifyTime}
          onCancel={vi.fn()}
        />
      )

      const modifyBtn = screen.getByRole('button', { name: "Changer l'heure" })
      fireEvent.click(modifyBtn)

      expect(onModifyTime).toHaveBeenCalledTimes(1)
    })

    it('triggers onCancel when clicking "Annuler"', () => {
      const onCancel = vi.fn()

      render(
        <ConflictAlertModal
          conflictingAppointment={sampleConflictingAppointment}
          newTime="2026-10-25T10:15"
          onForceSave={vi.fn()}
          onModifyTime={vi.fn()}
          onCancel={onCancel}
        />
      )

      const cancelBtn = screen.getByRole('button', { name: 'Annuler' })
      fireEvent.click(cancelBtn)

      expect(onCancel).toHaveBeenCalledTimes(1)
    })
  })

  // =========================================================================
  // 3. محاكاة التعارض الكامل داخل NewAppointmentDrawer وتحديث التاريخ تلقائياً
  // =========================================================================
  describe('3. End-to-End Conflict Detection Workflow in NewAppointmentDrawer', () => {
    // Generate a valid future date
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 7)
    const pad = (n: number) => String(n).padStart(2, '0')
    const futureIsoDate = `${futureDate.getFullYear()}-${pad(futureDate.getMonth() + 1)}-${pad(
      futureDate.getDate()
    )}`

    const bookedAppointment: Appointment = {
      id: 'apt-future-booked',
      patientId: 'pat-100',
      patientName: 'Kamel Madani',
      patientPhone: '0555112233',
      dateTime: `${futureIsoDate}T10:00:00`,
      durationMinutes: 30, // 10:00 to 10:30
      treatmentType: 'Consultation & Soins',
      status: 'CONFIRMED',
      dentistName: 'Dr. Mohamed Amrani'
    }

    beforeEach(() => {
      vi.clearAllMocks()
      window.api.getAppointments = vi.fn().mockResolvedValue([bookedAppointment])
      window.api.getPatients = vi.fn().mockResolvedValue([samplePatient])
      window.api.saveAppointment = vi.fn().mockImplementation((apt) =>
        Promise.resolve({
          id: 'new-apt-saved',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...apt
        })
      )
    })

    it('detects overlap on submit, opens ConflictAlertModal, and auto-updates datetime input when choosing alternative slot', async () => {
      const onClose = vi.fn()
      const onSuccess = vi.fn()

      render(
        <ToastProvider>
          <ToastContainer />
          <NewAppointmentDrawer
            initialDate={`${futureIsoDate}T10:15`}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        </ToastProvider>
      )

      // Verify date input is initialized with 10:15
      const dateTimeInput = document.querySelector('input[type="datetime-local"]') as HTMLInputElement
      expect(dateTimeInput.value).toBe(`${futureIsoDate}T10:15`)

      // Fill patient name if manual input is shown
      const nameInput = screen.queryByPlaceholderText('Nom & Prénom *')
      if (nameInput) {
        fireEvent.change(nameInput, { target: { value: 'Farid Zidane' } })
      }

      // Try to submit -> Conflict should be triggered
      const submitBtn = screen.getByRole('button', { name: /Confirmer le Rendez-vous/i })
      fireEvent.click(submitBtn)

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText("Conflit d'horaire détecté")).toBeInTheDocument()
      })

      expect(screen.getByText('Rendez-vous existant en chevauchement :')).toBeInTheDocument()
      expect(screen.getByText('Kamel Madani')).toBeInTheDocument()

      // Alternative slot should be 10:30
      expect(screen.getAllByText(/10:30/).length).toBeGreaterThanOrEqual(1)

      // Click "Choisir le créneau alternatif"
      const chooseAltBtn = screen.getByRole('button', {
        name: /Choisir.*10:30/i
      })
      fireEvent.click(chooseAltBtn)

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText("Conflit d'horaire détecté")).not.toBeInTheDocument()
      })

      // The date & time input must be updated automatically to 10:30
      expect(dateTimeInput.value).toBe(`${futureIsoDate}T10:30`)

      // Success info toast shown
      expect(screen.getByText('Créneau alternatif appliqué avec succès !')).toBeInTheDocument()
    })

    it('opens NewPatientModal when clicking "+ Nouveau Patient" and auto-selects newly created patient', async () => {
      const onClose = vi.fn()
      const onSuccess = vi.fn()

      window.api.savePatient = vi.fn().mockImplementation((pat) =>
        Promise.resolve({
          id: 'pat-quick-888',
          patientNumber: 'DZ-2026-0888',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...pat
        })
      )

      render(
        <ToastProvider>
          <ToastContainer />
          <NewAppointmentDrawer
            initialDate={`${futureIsoDate}T14:00`}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        </ToastProvider>
      )

      // Button "+ Nouveau Patient" must be rendered
      const newPatientBtn = screen.getByRole('button', { name: /\+ Nouveau Patient/i })
      expect(newPatientBtn).toBeInTheDocument()

      // Click button
      fireEvent.click(newPatientBtn)

      // Modal "Créer un Dossier Patient" opens
      expect(screen.getByText('Créer un Dossier Patient')).toBeInTheDocument()

      // Fill in First Name and Last Name and Phone
      fireEvent.change(screen.getByPlaceholderText('Ex: Amine'), { target: { value: 'Karim' } })
      fireEvent.change(screen.getByPlaceholderText('Ex: Mansouri'), { target: { value: 'Saadi' } })
      fireEvent.change(screen.getByPlaceholderText('0550123456'), { target: { value: '0770998877' } })

      // Submit creation form
      const submitPatientBtn = screen.getByRole('button', { name: /Enregistrer le Patient/i })
      fireEvent.click(submitPatientBtn)

      // Wait for modal to close and new patient to be selected in drawer
      await waitFor(() => {
        expect(screen.queryByText('Créer un Dossier Patient')).not.toBeInTheDocument()
      })

      // The new patient's name must be selected and displayed in the drawer
      expect(screen.getByText('Karim Saadi')).toBeInTheDocument()
      expect(screen.getByText(/DZ-2026-0888/)).toBeInTheDocument()
    })
  })
})
