import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PatientDevisTab from '../../src/renderer/src/features/patients/PatientDevisTab'
import PatientBilansTab from '../../src/renderer/src/features/patients/PatientBilansTab'
import { ToastProvider } from '../../src/renderer/src/context/ToastContext'
import ToastContainer from '../../src/renderer/src/features/common/ToastContainer'
import { Patient, Devis, PatientRadio } from '@shared/types'

const samplePatient: Patient = {
  id: 'pat-prompt8-01',
  patientNumber: 'DZ-2026-0099',
  firstName: 'Karim',
  lastName: 'Mansouri',
  phone: '0661223344',
  dateOfBirth: '1985-04-12',
  wilaya: '16 - Alger',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
}

const sampleDevis: Devis = {
  id: 'dev-001',
  devisNumber: 'DEV-2026-0042',
  patientId: samplePatient.id,
  patientName: 'Karim Mansouri',
  dentistName: 'Dr Mohamed Amrani',
  date: '2026-10-02',
  validityDays: 30,
  totalGrossDA: 45000,
  discountDA: 5000,
  totalNetDA: 40000,
  status: 'SENT',
  notes: 'Plan de traitement prothétique et endodontique',
  items: [
    {
      id: 'item-1',
      devisId: 'dev-001',
      actName: 'Couronne Céramo-Métallique',
      specialty: 'PROTHESE_FIXE',
      toothNumber: 36,
      quantity: 1,
      unitPriceDA: 25000,
      totalPriceDA: 25000
    },
    {
      id: 'item-2',
      devisId: 'dev-001',
      actName: 'Traitement Endodontique Molaire',
      specialty: 'SOINS',
      toothNumber: 36,
      quantity: 1,
      unitPriceDA: 15000,
      totalPriceDA: 15000
    }
  ],
  createdAt: '2026-10-02',
  updatedAt: '2026-10-02'
}

const sampleRadio: PatientRadio = {
  id: 'rad-001',
  patientId: samplePatient.id,
  radioType: 'Rétro-alvéolaire',
  toothNumber: 36,
  date: '2026-10-02',
  imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  fileName: 'apex_36.png',
  fileSize: 1024 * 512,
  notes: 'Contrôle apical sur 36. Élargissement ligamentaire modéré.',
  createdAt: '2026-10-02',
  updatedAt: '2026-10-02'
}

describe('Prompt 8: Devis Lifecycle [En Soin] Conversion & Dental Radiography Lightbox System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // Mock electron API
    window.api.getDevis = vi.fn().mockResolvedValue([sampleDevis])
    window.api.updateDevisStatus = vi.fn().mockResolvedValue(true)
    window.api.convertDevisToTreatments = vi.fn().mockResolvedValue({
      success: true,
      createdTreatmentsCount: 2
    })
    window.api.getPatientRadios = vi.fn().mockResolvedValue([sampleRadio])
    window.api.savePatientRadio = vi.fn().mockImplementation((r) =>
      Promise.resolve({
        id: 'rad-new-02',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...r
      })
    )
    window.api.deletePatientRadio = vi.fn().mockResolvedValue(true)
    window.api.getLabTestOrders = vi.fn().mockResolvedValue([])

    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      if (this.onload) {
        this.onload({ target: { result: 'data:image/png;base64,sample' } } as any)
      }
    })
  })

  // =========================================================================
  // 1. دورة حياة الـ Devis وزر [En Soin]
  // =========================================================================
  describe('1. Devis Lifecycle & [En Soin] Chairside Conversion', () => {
    it('displays the [En Soin] button for a pending devis in PatientDevisTab', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <PatientDevisTab patient={samplePatient} />
        </ToastProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('DEV-2026-0042')).toBeInTheDocument()
      })

      const enSoinBtn = screen.getByTestId(`btn-en-soin-${sampleDevis.id}`)
      expect(enSoinBtn).toBeInTheDocument()
      expect(enSoinBtn).toHaveTextContent(/En Soin/i)
    })

    it('clicking [En Soin] immediately validates devis to "Accepté" and displays confirmation toast: "Devis validé. Les actes sont prêts pour planification au fauteuil."', async () => {
      const onTreatmentsCreated = vi.fn()

      render(
        <ToastProvider>
          <ToastContainer />
          <PatientDevisTab patient={samplePatient} onTreatmentsCreated={onTreatmentsCreated} />
        </ToastProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('DEV-2026-0042')).toBeInTheDocument()
      })

      const enSoinBtn = screen.getByTestId(`btn-en-soin-${sampleDevis.id}`)
      fireEvent.click(enSoinBtn)

      await waitFor(() => {
        expect(window.api.convertDevisToTreatments).toHaveBeenCalledWith(sampleDevis.id)
      })

      // Toast confirmation verification
      await waitFor(() => {
        expect(
          screen.getByText('Devis validé. Les actes sont prêts pour planification au fauteuil.')
        ).toBeInTheDocument()
      })

      expect(onTreatmentsCreated).toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 2. نظام رفع صور الأشعة (Radios)
  // =========================================================================
  describe('2. Radiography Upload System in Patient File', () => {
    it('renders the "+ Ajouter une Radio" button in PatientBilansTab', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <PatientBilansTab patient={samplePatient} />
        </ToastProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('btn-add-radio')).toBeInTheDocument()
      })
    })

    it('opens upload modal, selects examination type, tooth, date, notes and saves successfully', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <PatientBilansTab patient={samplePatient} />
        </ToastProvider>
      )

      const addRadioBtn = await screen.findByTestId('btn-add-radio')
      fireEvent.click(addRadioBtn)

      // Modal is visible
      expect(screen.getByText('Ajouter une Radiographie Dentaire')).toBeInTheDocument()

      // Select examination type
      const typeSelect = screen.getByTestId('select-radio-type')
      fireEvent.change(typeSelect, { target: { value: 'Scanner 3D' } })

      // Target tooth
      const toothInput = screen.getByTestId('input-radio-tooth')
      fireEvent.change(toothInput, { target: { value: '46' } })

      // Date
      const dateInput = screen.getByTestId('input-radio-date')
      fireEvent.change(dateInput, { target: { value: '2026-10-02' } })

      // Notes
      const notesInput = screen.getByTestId('textarea-radio-notes')
      fireEvent.change(notesInput, {
        target: { value: 'Volume osseux satisfaisant pour implant 46' }
      })

      // Simulate file upload (JPG/PNG/DICOM)
      const fileInput = screen.getByTestId('input-radio-file')
      const fakeFile = new File(['fake-dicom-image-content'], 'cbct_46.png', {
        type: 'image/png'
      })

      // Fire file change
      Object.defineProperty(fileInput, 'files', {
        value: [fakeFile]
      })
      fireEvent.change(fileInput)

      // Submit
      const saveBtn = screen.getByTestId('btn-save-radio')
      await waitFor(() => {
        expect(saveBtn).not.toBeDisabled()
      })
      fireEvent.click(saveBtn)

      await waitFor(() => {
        expect(window.api.savePatientRadio).toHaveBeenCalled()
      })
    })
  })

  // =========================================================================
  // 3. معرض الصور والمكبر عالي الدقة (Lightbox)
  // =========================================================================
  describe('3. Radiography Gallery & High-Resolution Lightbox Viewer', () => {
    it('displays the radiographies gallery with examination badges and tooth number', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <PatientBilansTab patient={samplePatient} />
        </ToastProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('radio-card')).toBeInTheDocument()
      })

      expect(screen.getByText('Rétro-alvéolaire')).toBeInTheDocument()
      expect(screen.getByText('Dent #36')).toBeInTheDocument()
    })

    it('opens the High-Resolution Lightbox upon clicking a radio thumbnail', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <PatientBilansTab patient={samplePatient} />
        </ToastProvider>
      )

      const openLightboxBtn = await screen.findByTestId(`btn-open-lightbox-${sampleRadio.id}`)
      fireEvent.click(openLightboxBtn)

      // Lightbox opened
      expect(screen.getByTestId('radio-lightbox')).toBeInTheDocument()
      expect(screen.getByTestId('lightbox-image')).toBeInTheDocument()
      expect(
        screen.getAllByText('Contrôle apical sur 36. Élargissement ligamentaire modéré.').length
      ).toBeGreaterThanOrEqual(1)
    })

    it('supports Zoom In, Zoom Out, and Reset Zoom in Lightbox', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <PatientBilansTab patient={samplePatient} />
        </ToastProvider>
      )

      const openLightboxBtn = await screen.findByTestId(`btn-open-lightbox-${sampleRadio.id}`)
      fireEvent.click(openLightboxBtn)

      const zoomDisplay = screen.getByTestId('zoom-level-display')
      expect(zoomDisplay).toHaveTextContent('100%')

      // Zoom In
      const zoomInBtn = screen.getByTestId('btn-zoom-in')
      fireEvent.click(zoomInBtn)
      expect(zoomDisplay).toHaveTextContent('125%')

      fireEvent.click(zoomInBtn)
      expect(zoomDisplay).toHaveTextContent('150%')

      // Zoom Out
      const zoomOutBtn = screen.getByTestId('btn-zoom-out')
      fireEvent.click(zoomOutBtn)
      expect(zoomDisplay).toHaveTextContent('125%')

      // Reset Zoom
      const resetBtn = screen.getByTestId('btn-zoom-reset')
      fireEvent.click(resetBtn)
      expect(zoomDisplay).toHaveTextContent('100%')
    })

    it('toggles Color Inversion and High Contrast filters for apical lesion detection', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <PatientBilansTab patient={samplePatient} />
        </ToastProvider>
      )

      const openLightboxBtn = await screen.findByTestId(`btn-open-lightbox-${sampleRadio.id}`)
      fireEvent.click(openLightboxBtn)

      const image = screen.getByTestId('lightbox-image')
      expect(image.style.filter).toBe('')

      // Invert Colors toggle
      const invertBtn = screen.getByTestId('btn-toggle-invert')
      fireEvent.click(invertBtn)
      expect(image.style.filter).toContain('invert(1)')

      // High Contrast toggle
      const contrastBtn = screen.getByTestId('btn-toggle-contrast')
      fireEvent.click(contrastBtn)
      expect(image.style.filter).toContain('contrast(180%)')

      // Toggle off invert
      fireEvent.click(invertBtn)
      expect(image.style.filter).not.toContain('invert(1)')
      expect(image.style.filter).toContain('contrast(180%)')
    })

    it('allows rotating the image and closing the Lightbox', async () => {
      render(
        <ToastProvider>
          <ToastContainer />
          <PatientBilansTab patient={samplePatient} />
        </ToastProvider>
      )

      const openLightboxBtn = await screen.findByTestId(`btn-open-lightbox-${sampleRadio.id}`)
      fireEvent.click(openLightboxBtn)

      const rotateBtn = screen.getByTestId('btn-rotate')
      fireEvent.click(rotateBtn)

      const closeBtn = screen.getByTestId('btn-close-lightbox')
      fireEvent.click(closeBtn)

      await waitFor(() => {
        expect(screen.queryByTestId('radio-lightbox')).not.toBeInTheDocument()
      })
    })
  })
})
