import React, { useState, useEffect } from 'react'
import { Prescription, PrescriptionItem, Patient, DrugItem, PrescriptionTemplate } from '@shared/types'
import { clinicalService } from '../../services/clinicalService'
import { drugService } from '../../services/drugService'
import { useToast } from '../../context/ToastContext'
import PrintablePrescription from './PrintablePrescription'

interface PrescriptionBuilderProps {
  patient: Patient
  dentistName?: string
  onPrescriptionUpdated?: () => void
}

const DRUG_CATEGORIES = [
  'Tous',
  'Antibiotique',
  'Antalgique',
  'Anti-inflammatoire',
  'Bain de bouche',
  'Autre'
]

const DRUG_FORMS = [
  'Comprimé',
  'Gélule',
  'Sachet',
  'Flacon',
  'Solution',
  'Bain de bouche',
  'Gel gingival',
  'Pommade',
  'Ampoule'
]

export default function PrescriptionBuilder({
  patient,
  dentistName = 'Dr. Mohamed Amrani',
  onPrescriptionUpdated
}: PrescriptionBuilderProps): JSX.Element {
  const { showToast } = useToast()

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [previewPrescription, setPreviewPrescription] = useState<Prescription | null>(null)

  // Edit & Delete Prescription State
  const [editingPrescriptionId, setEditingPrescriptionId] = useState<string | null>(null)
  const [prescriptionToDelete, setPrescriptionToDelete] = useState<Prescription | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Catalog & Templates State
  const [catalogDrugs, setCatalogDrugs] = useState<DrugItem[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCategory, setCatalogCategory] = useState('Tous')
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  // Builder Active Tab: CATALOG | CUSTOM
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'CUSTOM'>('CATALOG')

  // Current draft items
  const [items, setItems] = useState<PrescriptionItem[]>([
    {
      id: 'default_rx_1',
      prescriptionId: '',
      medicineName: 'Bi-Rodogyl',
      dosage: 'Spiramycine 1.5 M.UI / Métronidazole 250mg',
      form: 'Comprimé',
      instructions: '1 comprimé 3 fois par jour au cours des repas pendant 6 jours'
    },
    {
      id: 'default_rx_2',
      prescriptionId: '',
      medicineName: 'Paracétamol',
      dosage: '1g',
      form: 'Comprimé',
      instructions: '1 comprimé toutes les 6 heures en cas de douleur (Max 3g/jour)'
    }
  ])
  const [notes, setNotes] = useState("Traitement d'urgence - Éviter la consommation d'alcool pendant la prise")
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [isSaving, setIsSaving] = useState(false)

  // Selected drug from catalog for inline customisation before adding
  const [selectedCatalogDrug, setSelectedCatalogDrug] = useState<DrugItem | null>(null)
  const [catalogCustomDosage, setCatalogCustomDosage] = useState('')
  const [catalogCustomForm, setCatalogCustomForm] = useState('Comprimé')
  const [catalogCustomInstructions, setCatalogCustomInstructions] = useState('')

  // Custom drug tab inputs
  const [customName, setCustomName] = useState('Flagyl')
  const [customDosage, setCustomDosage] = useState('500mg')
  const [customForm, setCustomForm] = useState('Comprimé')
  const [customInstructions, setCustomInstructions] = useState('1 comprimé matin et soir pendant 5 jours')
  const [customCategory, setCustomCategory] = useState('Antibiotique')
  const [saveToPermanentCatalog, setSaveToPermanentCatalog] = useState(true)

  // Save as Template Modal
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false)
  const [newTemplateTitle, setNewTemplateTitle] = useState('Gabarit Extraction & Soins')
  const [newTemplateHint, setNewTemplateHint] = useState('Prescription post-avulsion ou curetage')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)

  // Load Prescriptions history
  const loadPrescriptions = async (): Promise<void> => {
    try {
      const data = await clinicalService.getPrescriptions(patient.id)
      setPrescriptions(data)
    } catch (err) {
      console.error('Failed to load patient prescriptions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Load Catalog Drugs
  const loadCatalogDrugs = async (search?: string, category?: string): Promise<void> => {
    try {
      const cat = category === 'Tous' ? undefined : category
      const data = await drugService.getDrugsCatalog(search, cat)
      setCatalogDrugs(data)
    } catch (err) {
      console.error('Failed to load drugs catalog:', err)
    }
  }

  // Load Templates
  const loadTemplates = async (): Promise<void> => {
    try {
      const data = await drugService.getPrescriptionTemplates()
      setTemplates(data)
    } catch (err) {
      console.error('Failed to load prescription templates:', err)
    }
  }

  useEffect(() => {
    loadPrescriptions()
    loadCatalogDrugs()
    loadTemplates()
  }, [patient.id])

  // Refilter catalog when search or category changes
  useEffect(() => {
    loadCatalogDrugs(catalogSearch, catalogCategory)
  }, [catalogSearch, catalogCategory])

  // Penicillin Allergy Cross-Check Helper
  const hasPenicillinAllergy = Boolean(
    patient.medicalAlerts &&
    /p[ée]nicilline|penicillin/i.test(patient.medicalAlerts)
  )

  const isPenicillinDrug = (name: string, generic?: string): boolean => {
    const target = `${name} ${generic || ''}`.toLowerCase()
    return (
      target.includes('amox') ||
      target.includes('augmentin') ||
      target.includes('clamoxyl') ||
      target.includes('penicill') ||
      target.includes('pénicill') ||
      target.includes('ampicill') ||
      target.includes('curam') ||
      target.includes('clavulin')
    )
  }

  // Select drug from catalog
  const handleSelectDrug = (drug: DrugItem): void => {
    if (hasPenicillinAllergy && isPenicillinDrug(drug.brandName, drug.genericName)) {
      showToast('⚠️ CONTRE-INDICATION VITALE : Le patient a une allergie documentée à la Pénicilline !', 'error')
    }
    setSelectedCatalogDrug(drug)
    setCatalogCustomDosage(drug.dosage || '')
    setCatalogCustomForm(drug.form || 'Comprimé')
    setCatalogCustomInstructions(drug.defaultInstructions || '')
  }

  // Add selected catalog drug to prescription
  const handleAddCatalogDrugToPrescription = (): void => {
    if (!selectedCatalogDrug) return

    if (hasPenicillinAllergy && isPenicillinDrug(selectedCatalogDrug.brandName, selectedCatalogDrug.genericName)) {
      showToast('⚠️ ALERTE : Amoxicilline / Pénicilline ajoutée chez un patient allergique !', 'error')
    }

    const newItem: PrescriptionItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      prescriptionId: '',
      medicineName: selectedCatalogDrug.brandName,
      dosage: catalogCustomDosage || selectedCatalogDrug.dosage || '',
      form: catalogCustomForm || selectedCatalogDrug.form || 'Comprimé',
      instructions: catalogCustomInstructions || selectedCatalogDrug.defaultInstructions || ''
    }

    setItems((prev) => [...prev, newItem])
    showToast(`Médicament ajouté : ${selectedCatalogDrug.brandName}`, 'info')
    setSelectedCatalogDrug(null)
  }

  // Double-click or quick add without modifying
  const handleQuickAddDrug = (drug: DrugItem): void => {
    if (hasPenicillinAllergy && isPenicillinDrug(drug.brandName, drug.genericName)) {
      showToast('⚠️ CONTRE-INDICATION VITALE : Le patient a une allergie documentée à la Pénicilline !', 'error')
    }
    const newItem: PrescriptionItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      prescriptionId: '',
      medicineName: drug.brandName,
      dosage: drug.dosage || '',
      form: drug.form || 'Comprimé',
      instructions: drug.defaultInstructions || ''
    }
    setItems((prev) => [...prev, newItem])
    showToast(`+ ${drug.brandName} ajouté`, 'info')
  }

  // Add Custom Drug from Tab 2
  const handleAddCustomDrug = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!customName.trim()) {
      showToast('Veuillez saisir le nom du médicament', 'warning')
      return
    }
    if (!customInstructions.trim()) {
      showToast('Veuillez indiquer la posologie et les instructions', 'warning')
      return
    }

    const newItem: PrescriptionItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      prescriptionId: '',
      medicineName: customName.trim(),
      dosage: customDosage.trim(),
      form: customForm,
      instructions: customInstructions.trim()
    }

    if (hasPenicillinAllergy && isPenicillinDrug(customName.trim())) {
      showToast('⚠️ CONTRE-INDICATION VITALE : Le patient a une allergie documentée à la Pénicilline !', 'error')
    }

    setItems((prev) => [...prev, newItem])

    // Save to permanent catalog if requested
    if (saveToPermanentCatalog) {
      try {
        await drugService.saveDrug({
          brandName: customName.trim(),
          genericName: customName.trim(),
          dosage: customDosage.trim(),
          form: customForm,
          defaultInstructions: customInstructions.trim(),
          category: customCategory,
          isCustom: 1
        })
        showToast(`"${customName.trim()}" enregistré dans votre catalogue permanent !`, 'success')
        // Refresh catalog list
        await loadCatalogDrugs(catalogSearch, catalogCategory)
      } catch (err) {
        console.error('Failed to save drug to catalog:', err)
        showToast("Erreur lors de l'enregistrement dans le catalogue", 'error')
      }
    } else {
      showToast(`+ ${customName.trim()} ajouté à la prescription`, 'info')
    }

    // Reset inputs
    setCustomName('')
    setCustomDosage('')
    setCustomInstructions('')
    setSaveToPermanentCatalog(false)
  }

  // Remove line item
  const handleRemoveItem = (index: number): void => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Apply Template from Dropdown
  const handleApplyTemplate = (templateId: string): void => {
    setSelectedTemplateId(templateId)
    if (!templateId) return

    const tpl = templates.find((t) => t.id === templateId)
    if (!tpl) return

    try {
      const parsedItems: { medicineName: string; dosage: string; form: string; instructions: string }[] =
        JSON.parse(tpl.itemsJson)

      const converted: PrescriptionItem[] = parsedItems.map((pi) => ({
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        prescriptionId: '',
        medicineName: pi.medicineName,
        dosage: pi.dosage || '',
        form: pi.form || 'Comprimé',
        instructions: pi.instructions || ''
      }))

      setItems(converted)
      if (tpl.diagnosisHint) {
        setNotes((prev) => (prev ? `${prev} · ${tpl.diagnosisHint}` : tpl.diagnosisHint || ''))
      }

      if (hasPenicillinAllergy && converted.some((c) => isPenicillinDrug(c.medicineName))) {
        showToast('⚠️ ATTENTION : Ce modèle contient de la Pénicilline / Amoxicilline alors que le patient est allergique !', 'error')
      } else {
        showToast(`Modèle "${tpl.title}" appliqué (${converted.length} médicaments)`, 'success')
      }
    } catch (err) {
      console.error('Failed to parse template items:', err)
      showToast('Erreur lors du chargement des médicaments du modèle', 'error')
    }
  }

  // Save current items as a new re-usable template
  const handleSaveAsTemplate = async (): Promise<void> => {
    if (!newTemplateTitle.trim()) {
      showToast('Veuillez donner un titre à ce modèle', 'warning')
      return
    }
    if (items.length === 0) {
      showToast('Ajoutez au moins un médicament avant de sauvegarder le modèle', 'warning')
      return
    }

    setIsSavingTemplate(true)
    try {
      const itemsToSave = items.map((it) => ({
        medicineName: it.medicineName,
        dosage: it.dosage,
        form: it.form,
        instructions: it.instructions
      }))

      await drugService.savePrescriptionTemplate({
        title: newTemplateTitle.trim(),
        diagnosisHint: newTemplateHint.trim() || undefined,
        itemsJson: JSON.stringify(itemsToSave)
      })

      showToast(`Modèle "${newTemplateTitle.trim()}" enregistré avec succès !`, 'success')
      setShowSaveTemplateModal(false)
      setNewTemplateTitle('')
      setNewTemplateHint('')
      await loadTemplates()
    } catch (err) {
      console.error('Failed to save prescription template:', err)
      showToast("Erreur lors de l'enregistrement du modèle", 'error')
    } finally {
      setIsSavingTemplate(false)
    }
  }

  // Open New Prescription Modal
  const handleOpenNewPrescription = (): void => {
    setEditingPrescriptionId(null)
    setDate(new Date().toISOString().split('T')[0])
    setNotes("Traitement d'urgence - Éviter la consommation d'alcool pendant la prise")
    setItems([])
    setSelectedCatalogDrug(null)
    setSelectedTemplateId('')
    setShowNewModal(true)
  }

  // Open Edit Prescription Modal with prefilled data
  const handleEditPrescription = (prescription: Prescription): void => {
    setEditingPrescriptionId(prescription.id)
    setDate(prescription.date || new Date().toISOString().split('T')[0])
    setNotes(prescription.notes || '')
    setItems(
      prescription.items && prescription.items.length > 0
        ? prescription.items.map((it) => ({ ...it }))
        : []
    )
    setSelectedCatalogDrug(null)
    setSelectedTemplateId('')
    setShowNewModal(true)
  }

  // Request Delete Prescription Modal
  const handleRequestDelete = (prescription: Prescription): void => {
    setPrescriptionToDelete(prescription)
  }

  // Confirm Delete Prescription
  const handleConfirmDelete = async (): Promise<void> => {
    if (!prescriptionToDelete) return
    setIsDeleting(true)
    try {
      await drugService.deletePrescription(prescriptionToDelete.id)
      showToast('Ordonnance supprimée avec succès !', 'success')
      setPrescriptionToDelete(null)
      await loadPrescriptions()
      onPrescriptionUpdated?.()
    } catch (err) {
      console.error('Failed to delete prescription:', err)
      showToast("Erreur lors de la suppression de l'ordonnance", 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  // Save & Print final prescription (Create or Update)
  const handleSaveAndPrint = async (): Promise<void> => {
    if (items.length === 0) {
      showToast('Veuillez ajouter au moins un médicament à la prescription', 'warning')
      return
    }

    setIsSaving(true)
    try {
      const isEditing = Boolean(editingPrescriptionId)
      const saved = await clinicalService.savePrescription({
        id: editingPrescriptionId || undefined,
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        dentistName,
        date,
        notes,
        items
      })

      showToast(
        isEditing ? 'Ordonnance modifiée avec succès !' : 'Ordonnance enregistrée avec succès !',
        'success'
      )
      await loadPrescriptions()
      onPrescriptionUpdated?.()
      setShowNewModal(false)
      setEditingPrescriptionId(null)
      setItems([])
      setNotes('')
      setSelectedTemplateId('')
      setPreviewPrescription(saved)
    } catch (err) {
      console.error('Failed to save prescription:', err)
      showToast("Erreur lors de l'enregistrement de l'ordonnance", 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">prescriptions</span>
            <span>Ordonnances Médicales & Prescriptions</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary-fixed text-secondary font-bold">
              {prescriptions.length}
            </span>
          </h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Catalogue pharmaceutique algérien, gabarits types réutilisables et impression normalisée A5/A4.
          </p>
        </div>

        <button
          onClick={handleOpenNewPrescription}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          <span>+ Rédiger une Ordonnance</span>
        </button>
      </div>

      {/* History of Prescriptions */}
      {isLoading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-secondary">
          <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
          <span className="text-xs font-medium">Chargement des ordonnances...</span>
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-12 text-center text-on-surface-variant text-xs space-y-3">
          <span className="material-symbols-outlined text-4xl text-outline">clinical_notes</span>
          <p className="font-medium">Aucune ordonnance rédigée pour ce patient.</p>
          <button
            onClick={handleOpenNewPrescription}
            className="text-secondary font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Rédiger la première ordonnance</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((p) => (
            <div
              key={p.id}
              className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-xs hover:border-secondary/50 transition-all space-y-4"
            >
              <div className="flex justify-between items-center pb-3 border-b border-outline-variant/30 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary-fixed text-secondary flex items-center justify-center font-black text-sm shadow-xs">
                    Rx
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-on-surface">
                      Ordonnance du {p.date} · {p.dentistName}
                    </h4>
                    <span className="text-xs text-on-surface-variant">
                      {p.items?.length || 0} médicament(s) prescrit(s)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditPrescription(p)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-secondary/40 hover:bg-secondary/10 text-xs font-semibold text-secondary transition-colors cursor-pointer"
                    title="Modifier l'ordonnance"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                    <span>Modifier</span>
                  </button>

                  <button
                    onClick={() => handleRequestDelete(p)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-xs font-semibold text-rose-600 transition-colors cursor-pointer"
                    title="Supprimer l'ordonnance"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                    <span>Supprimer</span>
                  </button>

                  <button
                    onClick={() => setPreviewPrescription(p)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-outline-variant/60 hover:bg-surface-container text-xs font-semibold text-on-surface transition-colors cursor-pointer"
                    title="Imprimer / Visualiser"
                  >
                    <span className="material-symbols-outlined text-base">print</span>
                    <span>Imprimer</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {p.items?.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-surface border border-outline-variant/40 flex justify-between items-start">
                    <div>
                      <div className="font-bold text-on-surface">
                        {item.medicineName} {item.dosage && <span className="text-primary font-semibold">{item.dosage}</span>}{' '}
                        {item.form && <span className="text-outline font-normal">({item.form})</span>}
                      </div>
                      <div className="text-[11px] text-on-surface-variant mt-1 italic">
                        {item.instructions}
                      </div>
                    </div>
                    <span className="w-5 h-5 rounded-full bg-surface-container-highest text-on-surface-variant text-[10px] flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                  </div>
                ))}
              </div>

              {p.notes && (
                <div className="text-xs text-on-surface-variant bg-surface-container/40 p-2.5 rounded-xl border border-outline-variant/30">
                  <strong className="text-on-surface">Recommandations :</strong> {p.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main Prescription Builder Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-surface-container-lowest w-full max-w-4xl rounded-2xl shadow-2xl border border-outline-variant overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-outline-variant/60 bg-surface-container-low flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary-fixed text-secondary flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-2xl">prescriptions</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-on-surface">
                    {editingPrescriptionId ? "Modifier l'Ordonnance" : "Rédiger une Ordonnance"} — {patient.firstName} {patient.lastName}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Dossier N° {patient.patientNumber} · {dentistName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Template Selector Top Bar */}
            <div className="px-6 py-3 bg-secondary-fixed/20 border-b border-secondary/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                <span className="material-symbols-outlined text-secondary text-lg">auto_fix_high</span>
                <span className="text-xs font-bold text-on-surface whitespace-nowrap">
                  Gabarits d'ordonnances types :
                </span>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleApplyTemplate(e.target.value)}
                  className="flex-1 max-w-md h-8 px-2.5 rounded-lg bg-surface-container-lowest border border-secondary/40 text-xs font-medium text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary cursor-pointer"
                >
                  <option value="">-- Choisir un modèle rapide (Abcès, Avulsion...) --</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.title} {tpl.diagnosisHint ? `(${tpl.diagnosisHint})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSaveTemplateModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-secondary-fixed border border-secondary/30 text-secondary text-xs font-bold transition-all cursor-pointer shrink-0 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-sm">bookmark_add</span>
                  <span>⭐ Enregistrer comme modèle</span>
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Medical Alerts / Allergy Banner */}
              {patient.medicalAlerts && (
                <div
                  className={`p-3 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs font-semibold ${
                    hasPenicillinAllergy
                      ? 'bg-amber-500/10 text-amber-900 border border-amber-500/30'
                      : 'bg-surface-container-high text-on-surface-variant border border-outline-variant'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-amber-600">medical_information</span>
                    <span>
                      Antécédents & Alertes Médicales : <strong>{patient.medicalAlerts}</strong>
                    </span>
                  </div>
                  {hasPenicillinAllergy && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-error text-on-error uppercase tracking-wider">
                      Allergie Pénicilline
                    </span>
                  )}
                </div>
              )}

              {/* Flashing Red Warning if Penicillin is currently prescribed to allergic patient */}
              {hasPenicillinAllergy && items.some((i) => isPenicillinDrug(i.medicineName)) && (
                <div className="p-4 rounded-xl bg-error-container/90 border-2 border-error text-error flex items-start gap-3 animate-pulse shadow-md">
                  <span className="material-symbols-outlined text-2xl shrink-0 mt-0.5">warning</span>
                  <div>
                    <div className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                      <span>Alerte Contre-Indication Vitale : Allergie à la Pénicilline</span>
                      <span className="px-2 py-0.5 rounded bg-error text-on-error text-[10px] font-extrabold uppercase">
                        Danger
                      </span>
                    </div>
                    <p className="text-xs mt-1 text-on-error-container font-semibold">
                      Le dossier médical de ce patient signale formellement : « {patient.medicalAlerts} ». La prescription en cours comprend une molécule à haut risque (Amoxicilline / Bêta-lactamines). Veuillez substituer ce traitement ou supprimer la molécule concernée.
                    </p>
                  </div>
                </div>
              )}

              {/* Dual-Tab Navigation */}
              <div className="flex border-b border-outline-variant/60">
                <button
                  type="button"
                  onClick={() => setActiveTab('CATALOG')}
                  className={`pb-3 px-5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    activeTab === 'CATALOG'
                      ? 'border-secondary text-secondary'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">medication</span>
                  <span>Catalogue Rapide ({catalogDrugs.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('CUSTOM')}
                  className={`pb-3 px-5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    activeTab === 'CUSTOM'
                      ? 'border-secondary text-secondary'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">edit_note</span>
                  <span>Nouveau Médicament (Saisie Libre)</span>
                </button>
              </div>

              {/* TAB 1: CATALOGUE RAPIDE */}
              {activeTab === 'CATALOG' && (
                <div className="space-y-4">
                  {/* Search and Category Filter */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg">
                        search
                      </span>
                      <input
                        type="text"
                        placeholder="Rechercher par nom ou générique (ex: Amox, Bi-Rodogyl, Paracétamol)..."
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
                      />
                      {catalogSearch && (
                        <button
                          onClick={() => setCatalogSearch('')}
                          className="absolute right-3 top-2.5 text-outline hover:text-on-surface"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      )}
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex gap-1 overflow-x-auto pb-1 items-center">
                      {DRUG_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCatalogCategory(cat)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                            catalogCategory === cat
                              ? 'bg-secondary text-on-secondary shadow-xs'
                              : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Drugs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                    {catalogDrugs.map((drug) => {
                      const isSelected = selectedCatalogDrug?.id === drug.id
                      return (
                        <div
                          key={drug.id}
                          onClick={() => handleSelectDrug(drug)}
                          onDoubleClick={() => handleQuickAddDrug(drug)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer group text-left ${
                            isSelected
                              ? 'border-secondary bg-secondary-fixed/25 shadow-xs'
                              : 'border-outline-variant/60 hover:border-secondary/50 bg-surface'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="font-bold text-xs text-on-surface group-hover:text-secondary truncate">
                              {drug.brandName}
                            </div>
                            {drug.isCustom === 1 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-tertiary-fixed text-tertiary font-bold">
                                Perso
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-primary font-medium mt-0.5">
                            {drug.dosage} · <span className="text-outline">{drug.form}</span>
                          </div>

                          {drug.genericName && drug.genericName !== drug.brandName && (
                            <div className="text-[10px] text-on-surface-variant truncate mt-0.5">
                              {drug.genericName}
                            </div>
                          )}

                          <div className="text-[10px] text-on-surface-variant line-clamp-1 mt-1 italic">
                            {drug.defaultInstructions}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {catalogDrugs.length === 0 && (
                    <div className="p-6 text-center text-xs text-on-surface-variant bg-surface rounded-xl border border-dashed border-outline-variant">
                      Aucun médicament trouvé pour "{catalogSearch}". Passez à l'onglet "Nouveau Médicament" pour l'ajouter.
                    </div>
                  )}

                  {/* Selected Drug Customizer Before Adding */}
                  {selectedCatalogDrug && (
                    <div className="p-4 rounded-xl border border-secondary/40 bg-secondary-fixed/15 space-y-3 animate-in fade-in">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base">tune</span>
                          <span>Ajuster avant ajout : {selectedCatalogDrug.brandName}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedCatalogDrug(null)}
                          className="text-outline hover:text-on-surface text-xs"
                        >
                          Annuler sélection
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">Dosage</label>
                          <input
                            type="text"
                            value={catalogCustomDosage}
                            onChange={(e) => setCatalogCustomDosage(e.target.value)}
                            className="w-full h-8 px-2.5 rounded-lg bg-surface border border-outline-variant text-xs text-on-surface"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">Forme</label>
                          <select
                            value={catalogCustomForm}
                            onChange={(e) => setCatalogCustomForm(e.target.value)}
                            className="w-full h-8 px-2 rounded-lg bg-surface border border-outline-variant text-xs text-on-surface"
                          >
                            {DRUG_FORMS.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">Catégorie</label>
                          <input
                            type="text"
                            disabled
                            value={selectedCatalogDrug.category || 'Standard'}
                            className="w-full h-8 px-2.5 rounded-lg bg-surface-container-high border border-outline-variant text-xs text-on-surface-variant"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={catalogCustomInstructions}
                          onChange={(e) => setCatalogCustomInstructions(e.target.value)}
                          placeholder="Posologie & durée (ex: 1 cp matin et soir pendant 6 jours)..."
                          className="flex-1 h-9 px-3 rounded-lg bg-surface border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-secondary"
                        />
                        <button
                          type="button"
                          onClick={handleAddCatalogDrugToPrescription}
                          className="px-4 h-9 rounded-lg bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <span className="material-symbols-outlined text-sm">add</span>
                          <span>+ Insérer</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: NOUVEAU MÉDICAMENT (SAISIE LIBRE) */}
              {activeTab === 'CUSTOM' && (
                <form onSubmit={handleAddCustomDrug} className="p-4 rounded-xl border border-outline-variant/60 bg-surface space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-secondary">add_circle</span>
                      <span>Saisie libre d'un nouveau médicament</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                        Nom commercial / Spécialité *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Dexon, Clamoxyl, Solupred..."
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-secondary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                        Dosage
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 4mg, 1g, 500mg"
                        value={customDosage}
                        onChange={(e) => setCustomDosage(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-secondary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                        Forme
                      </label>
                      <select
                        value={customForm}
                        onChange={(e) => setCustomForm(e.target.value)}
                        className="w-full h-9 px-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-secondary"
                      >
                        {DRUG_FORMS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                        Posologie & Instructions d'utilisation *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 1 cp 3 fois par jour après les repas pendant 5 jours"
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-secondary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                        Catégorie
                      </label>
                      <select
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full h-9 px-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-secondary"
                      >
                        {DRUG_CATEGORIES.filter((c) => c !== 'Tous').map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-outline-variant/40">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveToPermanentCatalog}
                        onChange={(e) => setSaveToPermanentCatalog(e.target.checked)}
                        className="w-4 h-4 rounded text-secondary border-outline-variant focus:ring-secondary"
                      />
                      <span className="text-xs font-bold text-on-surface">
                        ✔ Ajouter à mon catalogue permanent (pour réutilisation future)
                      </span>
                    </label>

                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <span className="material-symbols-outlined text-base">add</span>
                      <span>Ajouter à l'ordonnance</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Current Prescription Items List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                    Lignes de prescription actives ({items.length})
                  </label>
                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setItems([])}
                      className="text-[11px] text-error hover:underline"
                    >
                      Effacer tout
                    </button>
                  )}
                </div>

                {items.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-outline-variant text-center text-xs text-on-surface-variant bg-surface space-y-1">
                    <span className="material-symbols-outlined text-2xl text-outline block">playlist_add</span>
                    <p>Aucun médicament ajouté pour le moment.</p>
                    <p className="text-[11px] text-outline">
                      Sélectionnez un médicament dans le catalogue ou appliquez un gabarit type ci-dessus.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, idx) => {
                      const isAllergicItem = hasPenicillinAllergy && isPenicillinDrug(item.medicineName)
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                            isAllergicItem
                              ? 'border-error bg-error-container/20 ring-1 ring-error/50'
                              : 'border-secondary/30 bg-surface-container-low hover:border-secondary/60'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                                isAllergicItem ? 'bg-error text-on-error' : 'bg-secondary-fixed text-secondary'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-xs text-on-surface">
                                  {item.medicineName}{' '}
                                  {item.dosage && <span className="text-secondary">{item.dosage}</span>}
                                </span>
                                {item.form && <span className="text-[11px] text-outline">({item.form})</span>}
                                {isAllergicItem && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-error text-on-error uppercase tracking-wider animate-pulse flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[12px]">warning</span>
                                    Contre-indiqué (Allergie)
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-on-surface-variant mt-0.5 italic">
                                ↳ {item.instructions}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 text-outline hover:text-error hover:bg-error-container/20 rounded-lg transition-colors cursor-pointer"
                            title="Supprimer cette ligne"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Instructions and Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-outline-variant/60">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                    Conseils & Recommandations (optionnel)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: Ne pas interrompre les antibiotiques, appliquer de la glace 15 min..."
                    className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-secondary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                    Date de délivrance
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-secondary"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant/60 flex justify-between items-center">
              <span className="text-xs text-on-surface-variant">
                Total : <strong>{items.length}</strong> médicament(s)
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={items.length === 0 || isSaving}
                  onClick={handleSaveAndPrint}
                  className="px-5 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">
                    {editingPrescriptionId ? 'save' : 'print'}
                  </span>
                  <span>
                    {isSaving
                      ? 'Enregistrement...'
                      : editingPrescriptionId
                        ? 'Enregistrer les modifications'
                        : 'Enregistrer & Imprimer'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Template Modal Dialog */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-secondary/50 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-secondary">
              <span className="material-symbols-outlined text-2xl">bookmark_add</span>
              <h4 className="font-bold text-sm text-on-surface">
                Enregistrer comme Modèle d'Ordonnance
              </h4>
            </div>

            <p className="text-xs text-on-surface-variant">
              Ce modèle contiendra les <strong>{items.length}</strong> médicament(s) actuellement configurés et sera réutilisable pour n'importe quel patient en 1 clic.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Nom du modèle *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Alvéolite sèche, Soins post-implantaire..."
                  value={newTemplateTitle}
                  onChange={(e) => setNewTemplateTitle(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-surface border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-secondary"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Indication clinique / Diagnostic (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Douleur intense sans caillot 3j après extraction"
                  value={newTemplateHint}
                  onChange={(e) => setNewTemplateHint(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-surface border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-secondary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/40">
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!newTemplateTitle.trim() || isSavingTemplate}
                onClick={handleSaveAsTemplate}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSavingTemplate ? 'Enregistrement...' : 'Enregistrer le Modèle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation Suppression Ordonnance */}
      {prescriptionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-3xl border border-rose-300 shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">delete_forever</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-rose-700">Suppression de l'Ordonnance</h3>
                <p className="text-xs text-on-surface-variant font-mono">
                  Date : {prescriptionToDelete.date}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-950 font-medium space-y-1">
              <p className="font-bold flex items-center gap-1 text-rose-800">
                <span className="material-symbols-outlined text-sm">warning</span>
                Attention : Action Irréversible !
              </p>
              <p>
                Êtes-vous sûr de vouloir supprimer cette ordonnance du {prescriptionToDelete.date} ? Cette action est irréversible.
              </p>
              {prescriptionToDelete.items && prescriptionToDelete.items.length > 0 && (
                <div className="pt-1 text-[11px] text-rose-900">
                  <span className="font-semibold">{prescriptionToDelete.items.length} médicament(s) : </span>
                  {prescriptionToDelete.items.map((it) => it.medicineName).join(', ')}
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-outline-variant/40">
              <button
                type="button"
                onClick={() => setPrescriptionToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? 'Suppression...' : 'Oui, Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {previewPrescription && (
        <PrintablePrescription
          prescription={previewPrescription}
          patient={patient}
          onClose={() => setPreviewPrescription(null)}
        />
      )}
    </div>
  )
}
