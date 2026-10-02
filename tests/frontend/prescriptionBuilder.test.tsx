import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { ToastProvider } from '@renderer/context/ToastContext'
import ToastContainer from '@renderer/features/common/ToastContainer'
import PrescriptionBuilder from '@renderer/features/prescriptions/PrescriptionBuilder'
import PrintablePrescription from '@renderer/features/prescriptions/PrintablePrescription'
import { Patient, DrugItem, PrescriptionTemplate, Prescription } from '@shared/types'

const samplePatient: Patient = {
  id: 'pat-rx-101',
  patientNumber: 'DZ-2026-0101',
  firstName: 'Farid',
  lastName: 'Zidane',
  phone: '0661998877',
  wilaya: '16 - Alger',
  dateOfBirth: '1985-04-12',
  bloodGroup: 'A+',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
}

const sampleCatalogDrugs: DrugItem[] = [
  {
    id: 'drug-1',
    brandName: 'Amoxicilline',
    genericName: 'Amoxicilline trihydratée',
    dosage: '1g',
    form: 'Comprimé',
    defaultInstructions: '1 cp matin et soir pendant 6 jours',
    category: 'Antibiotique',
    isCustom: 0
  },
  {
    id: 'drug-2',
    brandName: 'Bi-Rodogyl',
    genericName: 'Spiramycine / Métronidazole',
    dosage: '1.5 MUI / 250 mg',
    form: 'Comprimé',
    defaultInstructions: '1 cp 3 fois par jour au cours des repas',
    category: 'Antibiotique',
    isCustom: 0
  },
  {
    id: 'drug-3',
    brandName: 'Paracétamol',
    genericName: 'Paracétamol',
    dosage: '1g',
    form: 'Comprimé',
    defaultInstructions: '1 cp toutes les 6 heures en cas de douleur',
    category: 'Antalgique',
    isCustom: 0
  }
]

const sampleTemplates: PrescriptionTemplate[] = [
  {
    id: 'tpl-avulsion-01',
    title: "Suite d'avulsion chirurgicale",
    diagnosisHint: 'Soins post-extraction de dents de sagesse incluses',
    itemsJson: JSON.stringify([
      {
        medicineName: 'Bi-Rodogyl',
        dosage: '1.5 MUI / 250 mg',
        form: 'Comprimé',
        instructions: '1 cp 3 fois par jour pendant 6 jours'
      },
      {
        medicineName: 'Paracétamol',
        dosage: '1g',
        form: 'Comprimé',
        instructions: '1 cp toutes les 6 heures en cas de douleur'
      }
    ]),
    createdAt: '2026-01-01'
  }
]

const renderBuilder = (patient = samplePatient, dentistName = 'Dr. Mohamed Amrani') => {
  return render(
    <ToastProvider>
      <ToastContainer />
      <PrescriptionBuilder patient={patient} dentistName={dentistName} />
    </ToastProvider>
  )
}

describe('PrescriptionBuilder & PrintablePrescription Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.api.getDrugsCatalog = vi.fn().mockResolvedValue(sampleCatalogDrugs)
    window.api.getPrescriptionTemplates = vi.fn().mockResolvedValue(sampleTemplates)
    window.api.getPrescriptions = vi.fn().mockResolvedValue([])
    window.api.saveDrug = vi.fn().mockImplementation((drug) =>
      Promise.resolve({ id: 'saved-drug-1', createdAt: new Date().toISOString(), ...drug })
    )
    window.api.savePrescriptionTemplate = vi.fn().mockImplementation((tpl) =>
      Promise.resolve({ id: 'saved-tpl-1', createdAt: new Date().toISOString(), ...tpl })
    )
    window.api.savePrescription = vi.fn().mockImplementation((p) =>
      Promise.resolve({ id: 'saved-rx-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...p })
    )
    window.api.printDocument = vi.fn().mockResolvedValue(true)
    window.api.exportToPDF = vi.fn().mockResolvedValue({
      success: true,
      filePath: 'C:\\exports\\Ordonnance_Farid_Zidane.pdf'
    })
  })

  describe('1. Tab 1: [Catalogue Rapide] Search, Selection & Customization', () => {
    it('searches for a drug, selects it from the catalog, auto-fills dosage and instructions, and allows editing before inserting', async () => {
      renderBuilder()

      // Open Prescription Builder modal
      const openBtn = await screen.findByRole('button', { name: /\+ Rédiger une Ordonnance/i })
      fireEvent.click(openBtn)

      // Ensure catalog loaded
      await waitFor(() => {
        expect(window.api.getDrugsCatalog).toHaveBeenCalled()
      })

      // Search for Amoxicilline
      const searchInput = screen.getByPlaceholderText(/Rechercher par nom ou générique/i)
      fireEvent.change(searchInput, { target: { value: 'Amox' } })

      // Select Amoxicilline drug card
      const drugCard = await screen.findByText('Amoxicilline')
      fireEvent.click(drugCard)

      // Verify customizer appears with auto-filled values
      expect(screen.getByText(/Ajuster avant ajout : Amoxicilline/i)).toBeInTheDocument()

      const dosageInput = screen.getByDisplayValue('1g')
      expect(dosageInput).toBeInTheDocument()

      const instructionsInput = screen.getByDisplayValue('1 cp matin et soir pendant 6 jours')
      expect(instructionsInput).toBeInTheDocument()

      // Customize dosage to 2g and instructions to 7 days
      fireEvent.change(dosageInput, { target: { value: '2g' } })
      fireEvent.change(instructionsInput, { target: { value: '1 cp matin et soir pendant 7 jours' } })

      // Click "+ Insérer" button
      const insertBtn = screen.getByRole('button', { name: /\+ Insérer/i })
      fireEvent.click(insertBtn)

      // Verify added into active lines list (name and dosage in separate spans)
      expect(screen.getAllByText('Amoxicilline').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('2g').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/1 cp matin et soir pendant 7 jours/i)).toBeInTheDocument()
    })
  })

  describe('2. Tab 2: [Nouveau Médicament] Manual Entry & Permanent Catalog Checkbox', () => {
    it('enters a custom manual drug, toggles permanent catalog checkbox, and triggers drugService.saveDrug', async () => {
      renderBuilder()

      const openBtn = await screen.findByRole('button', { name: /\+ Rédiger une Ordonnance/i })
      fireEvent.click(openBtn)

      // Switch to Tab 2: Nouveau Médicament
      const customTabBtn = screen.getByRole('button', { name: /Nouveau Médicament/i })
      fireEvent.click(customTabBtn)

      expect(screen.getByText(/Saisie libre d'un nouveau médicament/i)).toBeInTheDocument()

      // Fill custom drug details
      const nameInput = screen.getByPlaceholderText(/Ex: Dexon, Clamoxyl, Solupred/i)
      const dosageInput = screen.getByPlaceholderText(/Ex: 4mg, 1g, 500mg/i)
      const instructionsInput = screen.getByPlaceholderText(/Ex: 1 cp 3 fois par jour/i)

      fireEvent.change(nameInput, { target: { value: 'Dexon' } })
      fireEvent.change(dosageInput, { target: { value: '4mg' } })
      fireEvent.change(instructionsInput, { target: { value: '1 cp le matin après petit-déjeuner pendant 3 jours' } })

      // Verify checkbox "Ajouter à mon catalogue permanent" is present and checked
      const permanentCheckbox = screen.getByRole('checkbox', {
        name: /Ajouter à mon catalogue permanent/i
      })
      expect(permanentCheckbox).toBeChecked()

      // Submit custom drug
      const addBtn = screen.getByRole('button', { name: /Ajouter à l'ordonnance/i })
      fireEvent.click(addBtn)

      // Verify window.api.saveDrug was called with the custom drug details
      await waitFor(() => {
        expect(window.api.saveDrug).toHaveBeenCalledWith(
          expect.objectContaining({
            brandName: 'Dexon',
            dosage: '4mg',
            defaultInstructions: '1 cp le matin après petit-déjeuner pendant 3 jours',
            isCustom: 1
          })
        )
      })

      // Verify added into active prescription lines
      expect(screen.getByText('Dexon')).toBeInTheDocument()
      expect(screen.getByText('4mg')).toBeInTheDocument()
    })
  })

  describe('3. Prescription Templates (Gabarits Rapides)', () => {
    it('applies a pre-configured template and immediately populates the medicine table', async () => {
      renderBuilder()

      const openBtn = await screen.findByRole('button', { name: /\+ Rédiger une Ordonnance/i })
      fireEvent.click(openBtn)

      // Find template dropdown
      const templateSelect = await screen.findByRole('combobox')
      expect(templateSelect).toBeInTheDocument()

      // Select "Suite d'avulsion chirurgicale" template
      fireEvent.change(templateSelect, { target: { value: 'tpl-avulsion-01' } })

      // Items from template should populate the prescription lines
      expect(screen.getAllByText(/Bi-Rodogyl/i).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(/Paracétamol/i).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/1 cp 3 fois par jour pendant 6 jours/i)).toBeInTheDocument()
    })

    it('saves current prescription lines as a new reusable template via [⭐ Enregistrer comme modèle]', async () => {
      renderBuilder()

      const openBtn = await screen.findByRole('button', { name: /\+ Rédiger une Ordonnance/i })
      fireEvent.click(openBtn)

      // First apply a template so items exist in the active prescription
      const templateSelect = await screen.findByRole('combobox')
      fireEvent.change(templateSelect, { target: { value: 'tpl-avulsion-01' } })

      // Click "⭐ Enregistrer comme modèle" which is visible when items.length > 0
      const saveTemplateBtn = await screen.findByRole('button', {
        name: /Enregistrer comme modèle/i
      })
      fireEvent.click(saveTemplateBtn)

      // Modal appears
      expect(screen.getByText(/Enregistrer comme Modèle d'Ordonnance/i)).toBeInTheDocument()

      const titleInput = screen.getByPlaceholderText(/Ex: Alvéolite sèche/i)
      const hintInput = screen.getByPlaceholderText(/Ex: Douleur intense/i)

      fireEvent.change(titleInput, { target: { value: 'Modèle Chirurgie Dentaire' } })
      fireEvent.change(hintInput, { target: { value: 'Post-avulsion complexe' } })

      // Confirm save
      const confirmSaveBtn = screen.getByRole('button', { name: /Enregistrer le Modèle/i })
      fireEvent.click(confirmSaveBtn)

      // Verify template save API called
      await waitFor(() => {
        expect(window.api.savePrescriptionTemplate).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Modèle Chirurgie Dentaire',
            diagnosisHint: 'Post-avulsion complexe'
          })
        )
      })
    })
  })

  describe('4. PrintablePrescription Component (A4/A5 Algerian Sheet Formatting)', () => {
    const mockPrescription: Prescription = {
      id: 'presc-print-01',
      patientId: samplePatient.id,
      patientName: 'Farid Zidane',
      dentistName: 'Dr. Mohamed Amrani',
      date: '2026-09-24',
      notes: 'Bien respecter la durée complète du traitement.',
      items: [
        {
          id: 'item-1',
          prescriptionId: 'presc-print-01',
          medicineName: 'Bi-Rodogyl',
          dosage: '1.5 MUI / 250 mg',
          form: 'Comprimé',
          instructions: '1 cp 3 fois par jour au cours des repas pendant 6 jours'
        },
        {
          id: 'item-2',
          prescriptionId: 'presc-print-01',
          medicineName: 'Paracétamol',
          dosage: '1g',
          form: 'Comprimé',
          instructions: '1 cp toutes les 6 heures en cas de douleur'
        }
      ],
      createdAt: '2026-09-24',
      updatedAt: '2026-09-24'
    }

    it('renders the official A5 medical prescription with clinic header, patient details, and stamp signature area', () => {
      const onCloseMock = vi.fn()

      render(
        <ToastProvider>
          <ToastContainer />
          <PrintablePrescription
            prescription={mockPrescription}
            patient={samplePatient}
            onClose={onCloseMock}
          />
        </ToastProvider>
      )

      // Clinic Header & Dentist (appears in header and under signature stamp)
      expect(screen.getAllByText('Dr. Mohamed Amrani').length).toBe(2)
      expect(screen.getByText(/Chirurgien-Dentiste/i)).toBeInTheDocument()
      expect(screen.getByText(/DentaFlow Clinic DZ/i)).toBeInTheDocument()

      // Patient Data & Date
      expect(screen.getByText('Farid Zidane')).toBeInTheDocument()
      expect(screen.getByText('2026-09-24')).toBeInTheDocument()
      expect(screen.getByText(/DZ-2026-0101/i)).toBeInTheDocument()

      // Prescription medicines
      expect(screen.getByText(/Bi-Rodogyl 1.5 MUI \/ 250 mg/i)).toBeInTheDocument()
      expect(screen.getByText(/Paracétamol 1g/i)).toBeInTheDocument()
      expect(screen.getByText(/Bien respecter la durée complète du traitement/i)).toBeInTheDocument()

      // Signature & Stamp footer
      expect(screen.getByText(/Signature & Griffe/i)).toBeInTheDocument()
    })

    it('triggers native printing and PDF export with A5 page size', async () => {
      const onCloseMock = vi.fn()

      render(
        <ToastProvider>
          <ToastContainer />
          <PrintablePrescription
            prescription={mockPrescription}
            patient={samplePatient}
            onClose={onCloseMock}
          />
        </ToastProvider>
      )

      // Click Print
      const printBtn = screen.getByRole('button', { name: /imprimer/i })
      fireEvent.click(printBtn)

      await waitFor(() => {
        expect(window.api.printDocument).toHaveBeenCalledWith(
          expect.objectContaining({ printBackground: true })
        )
      })

      // Click Export PDF
      const exportPdfBtn = screen.getByRole('button', { name: /Exporter PDF/i })
      fireEvent.click(exportPdfBtn)

      await waitFor(() => {
        expect(window.api.exportToPDF).toHaveBeenCalledWith(
          expect.objectContaining({
            pageSize: 'A5',
            title: 'Ordonnance_Farid_Zidane'
          })
        )
      })
    })
  })

  // =========================================================================
  // 6. Edition et Suppression d'Ordonnances (Prompt 5)
  // =========================================================================
  describe('6. Prescription Modification and Deletion Workflows (Prompt 5)', () => {
    const existingPrescription: Prescription = {
      id: 'presc-edit-001',
      patientId: samplePatient.id,
      patientName: 'Farid Zidane',
      dentistName: 'Dr. Mohamed Amrani',
      date: '2026-09-24',
      notes: 'Traitement post-opératoire',
      items: [
        {
          id: 'item-1',
          prescriptionId: 'presc-edit-001',
          medicineName: 'Bi-Rodogyl',
          dosage: '1.5 MUI / 250 mg',
          form: 'Comprimé',
          instructions: '1 cp 3 fois par jour'
        }
      ],
      createdAt: '2026-09-24',
      updatedAt: '2026-09-24'
    }

    it('renders [Modifier] and [Supprimer] action buttons for each registered prescription', async () => {
      window.api.getPrescriptions = vi.fn().mockResolvedValue([existingPrescription])

      renderBuilder()

      await waitFor(() => {
        expect(screen.getByText('Ordonnance du 2026-09-24 · Dr. Mohamed Amrani')).toBeInTheDocument()
      })

      // Both Modifier and Supprimer action buttons must be present
      expect(screen.getByRole('button', { name: /modifier/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /supprimer/i })).toBeInTheDocument()
    })

    it('opens prescription editor prefilled with current prescription data upon clicking [Modifier] and saves update', async () => {
      window.api.getPrescriptions = vi.fn().mockResolvedValue([existingPrescription])

      renderBuilder()

      await waitFor(() => {
        expect(screen.getByText('Ordonnance du 2026-09-24 · Dr. Mohamed Amrani')).toBeInTheDocument()
      })

      // Click Modifier
      const editBtn = screen.getByRole('button', { name: /modifier/i })
      fireEvent.click(editBtn)

      // Modal title indicates modification mode
      await waitFor(() => {
        expect(screen.getByText(/Modifier l'Ordonnance/i)).toBeInTheDocument()
      })

      // Prefilled prescription item is visible
      expect(screen.getAllByText('Bi-Rodogyl').length).toBeGreaterThan(0)
      expect(screen.getAllByText('1.5 MUI / 250 mg').length).toBeGreaterThan(0)

      // Submit modifications
      const saveBtn = screen.getByRole('button', { name: /Enregistrer les modifications/i })
      fireEvent.click(saveBtn)

      await waitFor(() => {
        expect(window.api.savePrescription).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'presc-edit-001',
            patientId: samplePatient.id,
            patientName: 'Farid Zidane'
          })
        )
        expect(screen.getByText(/Ordonnance modifiée avec succès/i)).toBeInTheDocument()
      })
    })

    it('displays warning confirmation modal with exact text upon clicking [Supprimer] and confirms deletion', async () => {
      window.api.getPrescriptions = vi.fn().mockResolvedValue([existingPrescription])
      window.api.deletePrescription = vi.fn().mockResolvedValue(true)

      renderBuilder()

      await waitFor(() => {
        expect(screen.getByText('Ordonnance du 2026-09-24 · Dr. Mohamed Amrani')).toBeInTheDocument()
      })

      // Click Supprimer
      const deleteBtn = screen.getByRole('button', { name: /supprimer/i })
      fireEvent.click(deleteBtn)

      // Warning confirmation dialog appears with exact date text
      await waitFor(() => {
        expect(screen.getByText("Suppression de l'Ordonnance")).toBeInTheDocument()
        expect(
          screen.getByText(/Êtes-vous sûr de vouloir supprimer cette ordonnance du 2026-09-24 \? Cette action est irréversible\./i)
        ).toBeInTheDocument()
      })

      // Confirm deletion
      const confirmDeleteBtn = screen.getByRole('button', { name: /Oui, Supprimer/i })
      fireEvent.click(confirmDeleteBtn)

      await waitFor(() => {
        expect(window.api.deletePrescription).toHaveBeenCalledWith('presc-edit-001')
        expect(screen.getByText(/Ordonnance supprimée avec succès/i)).toBeInTheDocument()
      })
    })
  })
})

