import React, { useState, useEffect, useMemo } from 'react'
import {
  Patient,
  ProstheticLaboratory,
  ProthesisOrder,
  ProthesisNature,
  ProthesisOrderStatus
} from '@shared/types'
import { prothesisService } from '../../services/prothesisService'
import { patientService } from '../../services/patientService'
import { useToast } from '../../context/ToastContext'

interface NewProthesisOrderModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newOrder: ProthesisOrder) => void
  initialPatient?: Patient | null
  existingOrder?: ProthesisOrder | null
}

// FDI Teeth Definitions (11-48 for Adults)
const QUADRANT_1 = [18, 17, 16, 15, 14, 13, 12, 11] // Maxillaire Droit
const QUADRANT_2 = [21, 22, 23, 24, 25, 26, 27, 28] // Maxillaire Gauche
const QUADRANT_4 = [48, 47, 46, 45, 44, 43, 42, 41] // Mandibulaire Droit
const QUADRANT_3 = [31, 32, 33, 34, 35, 36, 37, 38] // Mandibulaire Gauche

// VITA Classical & Modern Shade Guides with visual swatch approximation
export interface ShadeItem {
  code: string
  label: string
  bgHex: string
  textHex: string
  group: 'A' | 'B' | 'C' | 'D' | 'BLEACH'
}

export const VITA_SHADES: ShadeItem[] = [
  // Groupe A (Brun-Rougeâtre - Teintes les plus fréquentes)
  { code: 'A1', label: 'A1 (Clair)', bgHex: '#fcf8ec', textHex: '#453818', group: 'A' },
  { code: 'A2', label: 'A2 (Naturel standard)', bgHex: '#f9f1dd', textHex: '#453818', group: 'A' },
  { code: 'A3', label: 'A3 (Moyen soutenu)', bgHex: '#f4e7c7', textHex: '#453818', group: 'A' },
  { code: 'A3.5', label: 'A3.5 (Ambré soutenu)', bgHex: '#ebd8ad', textHex: '#3d2e12', group: 'A' },
  { code: 'A4', label: 'A4 (Brun foncé)', bgHex: '#dfc694', textHex: '#33230a', group: 'A' },

  // Groupe B (Jaune-Rougeâtre)
  { code: 'B1', label: 'B1 (Très lumineux)', bgHex: '#fdfbf0', textHex: '#453818', group: 'B' },
  { code: 'B2', label: 'B2 (Jaunâtre doux)', bgHex: '#faf3dd', textHex: '#453818', group: 'B' },
  { code: 'B3', label: 'B3 (Jaunâtre chaud)', bgHex: '#f6e9c4', textHex: '#453818', group: 'B' },
  { code: 'B4', label: 'B4 (Jaunâtre intense)', bgHex: '#ebd9a8', textHex: '#3d2e12', group: 'B' },

  // Groupe C (Grisâtre)
  { code: 'C1', label: 'C1 (Gris clair)', bgHex: '#f5f3ed', textHex: '#383835', group: 'C' },
  { code: 'C2', label: 'C2 (Gris moyen)', bgHex: '#eeeae1', textHex: '#383835', group: 'C' },
  { code: 'C3', label: 'C3 (Gris soutenu)', bgHex: '#e2dccf', textHex: '#2b2a26', group: 'C' },
  { code: 'C4', label: 'C4 (Gris foncé)', bgHex: '#d5cdbc', textHex: '#24231f', group: 'C' },

  // Groupe D (Gris-Rougeâtre)
  { code: 'D2', label: 'D2 (Rose-gris clair)', bgHex: '#f7eee7', textHex: '#40332d', group: 'D' },
  { code: 'D3', label: 'D3 (Rose-gris moyen)', bgHex: '#eddcd1', textHex: '#40332d', group: 'D' },
  { code: 'D4', label: 'D4 (Rose-gris soutenu)', bgHex: '#e0caba', textHex: '#362822', group: 'D' },

  // Teintes Blanchiment (Bleach) & 3D Master
  { code: 'BL1', label: 'BL1 (Ultra Blanc)', bgHex: '#ffffff', textHex: '#1e293b', group: 'BLEACH' },
  { code: 'BL2', label: 'BL2 (Blanc Éclatant)', bgHex: '#fafaff', textHex: '#1e293b', group: 'BLEACH' },
  { code: 'BL3', label: 'BL3 (Blanc Lumineux)', bgHex: '#f5f8ff', textHex: '#1e293b', group: 'BLEACH' },
  { code: 'BL4', label: 'BL4 (Blanc Doux)', bgHex: '#f2f5fa', textHex: '#1e293b', group: 'BLEACH' },
  { code: '1M1', label: '1M1 (3D Master)', bgHex: '#fcfcf5', textHex: '#333333', group: 'BLEACH' },
  { code: '2M2', label: '2M2 (3D Master)', bgHex: '#f8f4e6', textHex: '#333333', group: 'BLEACH' }
]

export const PROTHESIS_TYPES: {
  label: string
  nature: ProthesisNature
  isMultipleTeethAllowed: boolean
  defaultLabCostDA: number
  defaultClinicPriceDA: number
  defaultDaysLeadTime: number
}[] = [
  { label: 'Couronne Zircone Monolithique', nature: 'ZIRCONE', isMultipleTeethAllowed: true, defaultLabCostDA: 9000, defaultClinicPriceDA: 25000, defaultDaysLeadTime: 7 },
  { label: 'Couronne Céramo-Métallique (CCM)', nature: 'CERAMO_METALLIQUE', isMultipleTeethAllowed: true, defaultLabCostDA: 5000, defaultClinicPriceDA: 15000, defaultDaysLeadTime: 7 },
  { label: 'Couronne E.max Céramique pure', nature: 'EMAX', isMultipleTeethAllowed: true, defaultLabCostDA: 11000, defaultClinicPriceDA: 30000, defaultDaysLeadTime: 8 },
  { label: 'Facette Céramique E.max', nature: 'EMAX', isMultipleTeethAllowed: true, defaultLabCostDA: 12000, defaultClinicPriceDA: 35000, defaultDaysLeadTime: 8 },
  { label: 'Bridge Zircone (par inter)', nature: 'ZIRCONE', isMultipleTeethAllowed: true, defaultLabCostDA: 9000, defaultClinicPriceDA: 25000, defaultDaysLeadTime: 9 },
  { label: 'Bridge Céramo-Métallique', nature: 'CERAMO_METALLIQUE', isMultipleTeethAllowed: true, defaultLabCostDA: 5000, defaultClinicPriceDA: 15000, defaultDaysLeadTime: 8 },
  { label: 'Inlay / Onlay E.max', nature: 'INLAY_ONLAY', isMultipleTeethAllowed: true, defaultLabCostDA: 7500, defaultClinicPriceDA: 18000, defaultDaysLeadTime: 6 },
  { label: 'Couronne sur Implant (Zircone transvissée)', nature: 'ZIRCONE', isMultipleTeethAllowed: true, defaultLabCostDA: 15000, defaultClinicPriceDA: 45000, defaultDaysLeadTime: 10 },
  { label: 'Châssis Métallique Stellite', nature: 'STELLITE', isMultipleTeethAllowed: true, defaultLabCostDA: 16000, defaultClinicPriceDA: 45000, defaultDaysLeadTime: 12 },
  { label: 'Prothèse Résine Complète (1 arcade)', nature: 'RESINE_COMPLETE', isMultipleTeethAllowed: true, defaultLabCostDA: 12000, defaultClinicPriceDA: 30000, defaultDaysLeadTime: 10 },
  { label: 'Prothèse Partielle Résine (1-3 dents)', nature: 'RESINE_PARTIELLE', isMultipleTeethAllowed: true, defaultLabCostDA: 4000, defaultClinicPriceDA: 12000, defaultDaysLeadTime: 6 },
  { label: 'Gouttière thermoformée / de bruxisme', nature: 'GOUTTIERE', isMultipleTeethAllowed: false, defaultLabCostDA: 3000, defaultClinicPriceDA: 8000, defaultDaysLeadTime: 4 }
]

export default function NewProthesisOrderModal({
  isOpen,
  onClose,
  onSuccess,
  initialPatient,
  existingOrder
}: NewProthesisOrderModalProps): JSX.Element | null {
  const { showToast } = useToast()

  // Data
  const [patients, setPatients] = useState<Patient[]>([])
  const [labs, setLabs] = useState<ProstheticLaboratory[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Patient selection & search
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(initialPatient || null)
  const [patientSearch, setPatientSearch] = useState('')
  const [isChangingPatient, setIsChangingPatient] = useState(!initialPatient && !existingOrder)

  // Laboratory selection
  const [selectedLabId, setSelectedLabId] = useState('')
  const [dentistName, setDentistName] = useState('Dr. Mohamed Amrani')

  // Prosthesis nature & acts
  const [selectedTypeIndex, setSelectedTypeIndex] = useState(0)
  const [customActName, setCustomActName] = useState('')

  // Interactive FDI Tooth Selector
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([])

  // Shade & VITA Guide
  const [selectedShade, setSelectedShade] = useState('A2')
  const [customShade, setCustomShade] = useState('')
  const [shadeGroupFilter, setShadeGroupFilter] = useState<'ALL' | 'A' | 'B' | 'C' | 'D' | 'BLEACH'>('ALL')

  // Dates & Lead time
  const [sentDate, setSentDate] = useState(new Date().toISOString().slice(0, 10))
  const [expectedDate, setExpectedDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [status, setStatus] = useState<ProthesisOrderStatus>('SENT')

  // Financials (DA)
  const [labCostDA, setLabCostDA] = useState<number>(PROTHESIS_TYPES[0].defaultLabCostDA)
  const [clinicPriceDA, setClinicPriceDA] = useState<number>(PROTHESIS_TYPES[0].defaultClinicPriceDA)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Quick Add Lab inline drawer
  const [showQuickAddLab, setShowQuickAddLab] = useState(false)
  const [newLabName, setNewLabName] = useState('')
  const [newLabPhone, setNewLabPhone] = useState('')
  const [newLabWilaya, setNewLabWilaya] = useState('Alger')

  // Load patients and laboratories on mount
  useEffect(() => {
    if (!isOpen) return

    const loadData = async (): Promise<void> => {
      setIsLoadingData(true)
      try {
        const [patientList, labList] = await Promise.all([
          patientService.getPatients(),
          prothesisService.getLabs()
        ])
        setPatients(patientList)
        setLabs(labList)

        if (existingOrder) {
          const pat = patientList.find((p) => p.id === existingOrder.patientId) || null
          setSelectedPatient(pat)
          setIsChangingPatient(false)
          setSelectedLabId(existingOrder.labId)
          setDentistName(existingOrder.dentistName || 'Dr. Mohamed Amrani')

          // Parse teeth from string or single toothNumber
          if (existingOrder.teeth) {
            const parsed = existingOrder.teeth
              .split(',')
              .map((s) => parseInt(s.trim(), 10))
              .filter((n) => !isNaN(n))
            setSelectedTeeth(parsed)
          } else if (existingOrder.toothNumber) {
            setSelectedTeeth([existingOrder.toothNumber])
          } else {
            setSelectedTeeth([])
          }

          setSelectedShade(existingOrder.shade || 'A2')
          setStatus(existingOrder.status)
          setSentDate(existingOrder.sentDate ? existingOrder.sentDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
          setExpectedDate(existingOrder.expectedDate ? existingOrder.expectedDate.slice(0, 10) : '')
          setLabCostDA(existingOrder.labCostDA || 0)
          setClinicPriceDA(existingOrder.clinicPriceDA || 0)
          setNotes(existingOrder.notes || '')
          setCustomActName(existingOrder.actName)

          // Match type index if possible
          const typeIdx = PROTHESIS_TYPES.findIndex(
            (t) => t.nature === existingOrder.nature || t.label === existingOrder.actName
          )
          if (typeIdx >= 0) setSelectedTypeIndex(typeIdx)
        } else {
          if (initialPatient) {
            setSelectedPatient(initialPatient)
            setIsChangingPatient(false)
          }
          if (labList.length > 0 && !selectedLabId) {
            setSelectedLabId(labList[0].id)
          }
        }
      } catch (err) {
        console.error('Error fetching prothesis order data:', err)
      } finally {
        setIsLoadingData(false)
      }
    }

    loadData()
  }, [isOpen, initialPatient, existingOrder])

  // Lead time calculation in days
  const leadTimeDays = useMemo(() => {
    if (!sentDate || !expectedDate) return 0
    const start = new Date(sentDate).getTime()
    const end = new Date(expectedDate).getTime()
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24))
    return diff
  }, [sentDate, expectedDate])

  // Handle lead time preset buttons (e.g. +3j, +7j, +10j, +14j)
  const applyLeadTimePreset = (days: number): void => {
    const base = sentDate ? new Date(sentDate) : new Date()
    base.setDate(base.getDate() + days)
    setExpectedDate(base.toISOString().slice(0, 10))
  }

  // Handle Tooth selection toggle
  const toggleTooth = (tooth: number): void => {
    setSelectedTeeth((prev) => {
      if (prev.includes(tooth)) {
        return prev.filter((t) => t !== tooth)
      } else {
        return [...prev, tooth].sort((a, b) => a - b)
      }
    })
  }

  // Helper quick selectors for teeth
  const selectAntUpper = (): void => {
    const ant = [13, 12, 11, 21, 22, 23]
    setSelectedTeeth((prev) => Array.from(new Set([...prev, ...ant])).sort((a, b) => a - b))
  }

  const selectAntLower = (): void => {
    const ant = [43, 42, 41, 31, 32, 33]
    setSelectedTeeth((prev) => Array.from(new Set([...prev, ...ant])).sort((a, b) => a - b))
  }

  const selectFullUpperArch = (): void => {
    const arch = [...QUADRANT_1, ...QUADRANT_2]
    setSelectedTeeth(arch.sort((a, b) => a - b))
  }

  const selectFullLowerArch = (): void => {
    const arch = [...QUADRANT_4, ...QUADRANT_3]
    setSelectedTeeth(arch.sort((a, b) => a - b))
  }

  const clearAllTeeth = (): void => {
    setSelectedTeeth([])
  }

  // Type change handler
  const handleTypeSelect = (idx: number): void => {
    setSelectedTypeIndex(idx)
    const t = PROTHESIS_TYPES[idx]
    if (!existingOrder) {
      setLabCostDA(t.defaultLabCostDA)
      setClinicPriceDA(t.defaultClinicPriceDA)
      applyLeadTimePreset(t.defaultDaysLeadTime)
    }
  }

  // Quick Add Laboratory
  const handleCreateQuickLab = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newLabName.trim()) {
      showToast('Le nom du laboratoire partenaire est obligatoire', 'error')
      return
    }
    try {
      const created = await prothesisService.saveLab({
        name: newLabName.trim(),
        phone: newLabPhone.trim() || '0550000000',
        wilaya: newLabWilaya,
        active: 1
      })
      setLabs((prev) => [...prev, created])
      setSelectedLabId(created.id)
      setShowQuickAddLab(false)
      setNewLabName('')
      setNewLabPhone('')
      showToast(`Laboratoire "${created.name}" ajouté avec succès`, 'success')
    } catch (err: any) {
      showToast(`Erreur lors de l'ajout du labo : ${err?.message || 'Erreur'}`, 'error')
    }
  }

  // Filter patients for search dropdown
  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return []
    const term = patientSearch.toLowerCase()
    return patients.filter((p) =>
      p.lastName.toLowerCase().includes(term) ||
      p.firstName.toLowerCase().includes(term) ||
      p.phone.includes(term) ||
      p.patientNumber.toLowerCase().includes(term)
    )
  }, [patients, patientSearch])

  // Filtered shades
  const filteredShades = useMemo(() => {
    if (shadeGroupFilter === 'ALL') return VITA_SHADES
    return VITA_SHADES.filter((s) => s.group === shadeGroupFilter)
  }, [shadeGroupFilter])

  // Calculate patient age
  const patientAge = useMemo(() => {
    if (!selectedPatient?.dateOfBirth) return null
    try {
      const dob = new Date(selectedPatient.dateOfBirth)
      const diffMs = Date.now() - dob.getTime()
      const ageDate = new Date(diffMs)
      return Math.abs(ageDate.getUTCFullYear() - 1970)
    } catch {
      return null
    }
  }, [selectedPatient])

  // Form submission with rigorous and friendly validation messages
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    // 1. Patient validation
    if (!selectedPatient) {
      showToast("Veuillez sélectionner un patient valide dans le dossier avant d'enregistrer la commande.", 'error')
      setIsChangingPatient(true)
      return
    }

    // 2. Laboratory validation
    if (!selectedLabId) {
      showToast('Veuillez sélectionner un laboratoire prothétique partenaire.', 'error')
      return
    }

    // 3. Tooth validation for relevant prostheses
    const currentType = PROTHESIS_TYPES[selectedTypeIndex]
    const isFullProsthesis = currentType.nature === 'RESINE_COMPLETE' || currentType.nature === 'GOUTTIERE'
    if (selectedTeeth.length === 0 && !isFullProsthesis) {
      showToast('Veuillez sélectionner au moins une dent concernée sur le schéma dentaire FDI (11 à 48).', 'error')
      return
    }

    // 4. Shade validation
    const effectiveShade = customShade.trim() || selectedShade
    if (!effectiveShade) {
      showToast('Veuillez sélectionner la teinte de la prothèse (guide VITA ou Bleach).', 'error')
      return
    }

    // 5. Date validation
    if (sentDate && expectedDate && expectedDate < sentDate) {
      showToast("La date de livraison prévue ne peut pas être antérieure à la date d'envoi.", 'error')
      return
    }

    const lab = labs.find((l) => l.id === selectedLabId)
    const actName = customActName.trim() || currentType.label
    const nature = currentType.nature
    const toothNumber = selectedTeeth.length > 0 ? selectedTeeth[0] : null
    const teeth = selectedTeeth.length > 0 ? selectedTeeth.join(', ') : null

    setIsSubmitting(true)
    try {
      const saved = await prothesisService.saveOrder({
        ...(existingOrder?.id ? { id: existingOrder.id } : {}),
        ...(existingOrder?.orderNumber ? { orderNumber: existingOrder.orderNumber } : {}),
        patientId: selectedPatient.id,
        patientName: `${selectedPatient.lastName.toUpperCase()} ${selectedPatient.firstName}`,
        dentistName: dentistName || 'Dr. Mohamed Amrani',
        labId: selectedLabId,
        labName: lab?.name || 'Laboratoire Partenaire',
        actName,
        nature,
        toothNumber,
        teeth,
        shade: effectiveShade,
        status,
        sentDate,
        expectedDate: expectedDate || null,
        labCostDA: Number(labCostDA) || 0,
        clinicPriceDA: Number(clinicPriceDA) || 0,
        notes: notes.trim() || null
      })

      showToast(
        existingOrder
          ? `Commande prothèse ${saved.orderNumber} mise à jour avec succès`
          : `Nouvelle commande ${saved.orderNumber} enregistrée avec succès`,
        'success'
      )
      onSuccess(saved)
      onClose()
    } catch (err: any) {
      console.error('Error saving prothesis order:', err)
      showToast(`Erreur lors de l'enregistrement de la commande : ${err?.message || 'Erreur interne'}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-surface-container-lowest text-on-surface w-full max-w-4xl rounded-2xl shadow-2xl border border-outline-variant/60 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-surface-container-high border-b border-outline-variant/60 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">precision_manufacturing</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">
                {existingOrder ? `Modifier Commande ${existingOrder.orderNumber}` : 'Nouvelle Commande de Prothèse Dentaire'}
              </h2>
              <p className="text-xs text-on-surface-variant">
                Bon de travail laboratoire · Schéma FDI interactif · Nuancier VITA Algérie
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 text-sm max-h-[82vh] overflow-y-auto">
          
          {/* Section 1: Patient Auto-retrieved Card & Fast Search */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-on-surface flex items-center gap-1.5 uppercase tracking-wider">
                <span className="material-symbols-outlined text-secondary text-base">person</span>
                <span>1. Patient Bénéficiaire</span>
                <span className="text-error">*</span>
              </label>
              {selectedPatient && !isChangingPatient && (
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPatient(true)
                    setPatientSearch('')
                  }}
                  className="text-xs text-secondary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">swap_horiz</span>
                  <span>Changer de patient</span>
                </button>
              )}
            </div>

            {selectedPatient && !isChangingPatient ? (
              /* Auto-populated Patient Identity Card */
              <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in duration-150">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-secondary-fixed text-on-secondary-container font-black text-lg flex items-center justify-center shrink-0">
                    {selectedPatient.lastName[0]}
                    {selectedPatient.firstName[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-base text-on-surface">
                        {selectedPatient.lastName.toUpperCase()} {selectedPatient.firstName}
                      </span>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-secondary/10 text-secondary border border-secondary/20">
                        {selectedPatient.patientNumber}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant mt-1">
                      <span className="flex items-center gap-1 font-mono text-on-surface font-semibold">
                        <span className="material-symbols-outlined text-sm text-secondary">phone</span>
                        {selectedPatient.phone}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-outline">location_on</span>
                        {selectedPatient.wilaya || 'Alger'} {selectedPatient.address ? `(${selectedPatient.address})` : ''}
                      </span>
                      {patientAge !== null && (
                        <>
                          <span>·</span>
                          <span>{patientAge} ans</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
                    Dossier Patient Actif
                  </span>
                </div>
              </div>
            ) : (
              /* Fast Reactive Search Dropdown */
              <div className="relative">
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Rechercher par Nom, Prénom, Téléphone (05/06/07) ou N° Dossier (DZ-2026-XXXX)..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs placeholder:text-outline focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
                  />
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-base">
                    search
                  </span>
                </div>

                {patientSearch.trim().length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-surface-container-high border border-outline-variant rounded-xl shadow-xl divide-y divide-outline-variant/30">
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedPatient(p)
                            setIsChangingPatient(false)
                            setPatientSearch('')
                          }}
                          className="px-4 py-2.5 text-xs hover:bg-surface-container cursor-pointer flex justify-between items-center transition-colors"
                        >
                          <div>
                            <span className="font-bold text-on-surface">
                              {p.lastName.toUpperCase()} {p.firstName}
                            </span>
                            <span className="font-mono text-xs text-on-surface-variant ml-2">
                              {p.phone}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] font-bold text-secondary bg-surface-container px-2 py-0.5 rounded">
                            {p.patientNumber}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-on-surface-variant">
                        Aucun patient correspondant trouvé.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Interactive FDI Tooth Selector (Odontogramme FDI 11-48) */}
          <div className="space-y-3 p-4 bg-surface-container rounded-2xl border border-outline-variant/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-on-surface flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="material-symbols-outlined text-secondary text-base">dentistry</span>
                  <span>2. Schéma Dentaire FDI (11 à 48)</span>
                  <span className="text-error">*</span>
                </label>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Sélectionnez une ou plusieurs dents (multi-sélection supportée pour les bridges).
                </p>
              </div>

              {/* Tooth Selector Quick Actions */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={selectAntUpper}
                  className="px-2 py-1 rounded-lg bg-surface border border-outline-variant/80 hover:bg-surface-container-high font-medium transition-colors cursor-pointer"
                >
                  Antérieur Haut (13-23)
                </button>
                <button
                  type="button"
                  onClick={selectAntLower}
                  className="px-2 py-1 rounded-lg bg-surface border border-outline-variant/80 hover:bg-surface-container-high font-medium transition-colors cursor-pointer"
                >
                  Antérieur Bas (43-33)
                </button>
                <button
                  type="button"
                  onClick={selectFullUpperArch}
                  className="px-2 py-1 rounded-lg bg-surface border border-outline-variant/80 hover:bg-surface-container-high font-medium transition-colors cursor-pointer"
                >
                  Arcade Sup
                </button>
                <button
                  type="button"
                  onClick={selectFullLowerArch}
                  className="px-2 py-1 rounded-lg bg-surface border border-outline-variant/80 hover:bg-surface-container-high font-medium transition-colors cursor-pointer"
                >
                  Arcade Inf
                </button>
                {selectedTeeth.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllTeeth}
                    className="px-2 py-1 rounded-lg text-error hover:bg-error-container/30 font-bold transition-colors cursor-pointer"
                  >
                    Effacer tout
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Teeth Grid */}
            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/50 space-y-3">
              {/* Maxillaire (Upper Arch) */}
              <div>
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider block text-center mb-1">
                  Arcade Supérieure (Maxillaire)
                </span>
                <div className="flex justify-center items-center gap-1 sm:gap-2">
                  {/* Q1: 18 -> 11 */}
                  <div className="flex gap-1">
                    {QUADRANT_1.map((tooth) => {
                      const isSelected = selectedTeeth.includes(tooth)
                      return (
                        <button
                          key={tooth}
                          type="button"
                          onClick={() => toggleTooth(tooth)}
                          className={`w-7 h-9 sm:w-8 sm:h-10 rounded-lg font-mono font-bold text-xs transition-all flex flex-col items-center justify-center cursor-pointer ${
                            isSelected
                              ? 'bg-secondary text-on-secondary ring-2 ring-secondary/60 shadow-sm scale-105'
                              : 'bg-surface border border-outline-variant hover:border-secondary text-on-surface hover:bg-surface-container-high'
                          }`}
                          title={`Dent ${tooth} (Cadran 1 - Haut Droit)`}
                        >
                          <span className="text-[9px] opacity-60">▲</span>
                          <span>{tooth}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Midline separator */}
                  <div className="w-[1.5px] h-9 sm:h-10 bg-outline-variant/80" />

                  {/* Q2: 21 -> 28 */}
                  <div className="flex gap-1">
                    {QUADRANT_2.map((tooth) => {
                      const isSelected = selectedTeeth.includes(tooth)
                      return (
                        <button
                          key={tooth}
                          type="button"
                          onClick={() => toggleTooth(tooth)}
                          className={`w-7 h-9 sm:w-8 sm:h-10 rounded-lg font-mono font-bold text-xs transition-all flex flex-col items-center justify-center cursor-pointer ${
                            isSelected
                              ? 'bg-secondary text-on-secondary ring-2 ring-secondary/60 shadow-sm scale-105'
                              : 'bg-surface border border-outline-variant hover:border-secondary text-on-surface hover:bg-surface-container-high'
                          }`}
                          title={`Dent ${tooth} (Cadran 2 - Haut Gauche)`}
                        >
                          <span className="text-[9px] opacity-60">▲</span>
                          <span>{tooth}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Mandibule (Lower Arch) */}
              <div className="pt-2 border-t border-outline-variant/40">
                <div className="flex justify-center items-center gap-1 sm:gap-2">
                  {/* Q4: 48 -> 41 */}
                  <div className="flex gap-1">
                    {QUADRANT_4.map((tooth) => {
                      const isSelected = selectedTeeth.includes(tooth)
                      return (
                        <button
                          key={tooth}
                          type="button"
                          onClick={() => toggleTooth(tooth)}
                          className={`w-7 h-9 sm:w-8 sm:h-10 rounded-lg font-mono font-bold text-xs transition-all flex flex-col items-center justify-center cursor-pointer ${
                            isSelected
                              ? 'bg-secondary text-on-secondary ring-2 ring-secondary/60 shadow-sm scale-105'
                              : 'bg-surface border border-outline-variant hover:border-secondary text-on-surface hover:bg-surface-container-high'
                          }`}
                          title={`Dent ${tooth} (Cadran 4 - Bas Droit)`}
                        >
                          <span>{tooth}</span>
                          <span className="text-[9px] opacity-60">▼</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Midline separator */}
                  <div className="w-[1.5px] h-9 sm:h-10 bg-outline-variant/80" />

                  {/* Q3: 31 -> 38 */}
                  <div className="flex gap-1">
                    {QUADRANT_3.map((tooth) => {
                      const isSelected = selectedTeeth.includes(tooth)
                      return (
                        <button
                          key={tooth}
                          type="button"
                          onClick={() => toggleTooth(tooth)}
                          className={`w-7 h-9 sm:w-8 sm:h-10 rounded-lg font-mono font-bold text-xs transition-all flex flex-col items-center justify-center cursor-pointer ${
                            isSelected
                              ? 'bg-secondary text-on-secondary ring-2 ring-secondary/60 shadow-sm scale-105'
                              : 'bg-surface border border-outline-variant hover:border-secondary text-on-surface hover:bg-surface-container-high'
                          }`}
                          title={`Dent ${tooth} (Cadran 3 - Bas Gauche)`}
                        >
                          <span>{tooth}</span>
                          <span className="text-[9px] opacity-60">▼</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider block text-center mt-1">
                  Arcade Inférieure (Mandibule)
                </span>
              </div>
            </div>

            {/* Selected Teeth Badges Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-on-surface-variant font-bold">
                  {selectedTeeth.length === 0
                    ? 'Aucune dent sélectionnée'
                    : selectedTeeth.length === 1
                    ? 'Dent unitaire sélectionnée :'
                    : `Bridge / Dents multiples (${selectedTeeth.length} éléments) :`}
                </span>
                {selectedTeeth.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-secondary/15 text-secondary font-mono font-bold text-xs border border-secondary/30"
                  >
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() => toggleTooth(t)}
                      className="hover:text-error cursor-pointer"
                      title="Désélectionner"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              {selectedTeeth.length >= 2 && (
                <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                  Configuration Bridge Prothétique
                </span>
              )}
            </div>
          </div>

          {/* Section 3: Laboratory & Lead Time Calculation */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Partner Lab Dropdown */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-on-surface flex items-center gap-1 uppercase tracking-wider">
                    <span className="material-symbols-outlined text-secondary text-base">domain</span>
                    <span>3. Laboratoire Partenaire</span>
                    <span className="text-error">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddLab(!showQuickAddLab)}
                    className="text-[11px] font-bold text-secondary hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    <span className="material-symbols-outlined text-xs">add_circle</span>
                    <span>Nouveau Labo</span>
                  </button>
                </div>

                <select
                  required
                  value={selectedLabId}
                  onChange={(e) => setSelectedLabId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs font-medium focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
                >
                  <option value="" disabled>Sélectionner un laboratoire sous-traitant...</option>
                  {labs.map((lab) => (
                    <option key={lab.id} value={lab.id}>
                      {lab.name} ({lab.wilaya || 'Alger'}) — {lab.phone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prescribing Dentist */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                  Praticien Prescripteur
                </label>
                <input
                  type="text"
                  value={dentistName}
                  onChange={(e) => setDentistName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs font-medium focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Quick Add Lab inline drawer */}
            {showQuickAddLab && (
              <div className="p-4 bg-secondary-fixed/20 border border-secondary/30 rounded-xl space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 text-secondary font-bold text-xs">
                  <span className="material-symbols-outlined text-sm">add_business</span>
                  <span>Ajouter un nouveau laboratoire sous-traitant</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Nom du Labo (ex: Labo Dentaire El Bahia)"
                    value={newLabName}
                    onChange={(e) => setNewLabName(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Téléphone (ex: 0550 12 34 56)"
                    value={newLabPhone}
                    onChange={(e) => setNewLabPhone(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs font-mono"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Wilaya (ex: Alger, Oran)"
                      value={newLabWilaya}
                      onChange={(e) => setNewLabWilaya(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleCreateQuickLab}
                      className="px-3 py-1.5 bg-secondary text-white rounded-lg text-xs font-bold shrink-0 hover:bg-secondary/90 cursor-pointer"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Dates & Auto Lead Time Calculation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/60">
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface">Date d'Envoi Empreinte</label>
                <input
                  type="date"
                  required
                  value={sentDate}
                  onChange={(e) => setSentDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface flex items-center justify-between">
                  <span>Livraison Prévue</span>
                  {leadTimeDays > 0 && (
                    <span className="text-[11px] font-bold font-mono text-secondary">
                      {leadTimeDays} jours
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  required
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface">Statut Initial</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProthesisOrderStatus)}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs font-semibold focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
                >
                  <option value="PREPARATION">1. En Préparation / Empreinte</option>
                  <option value="SENT">2. Envoyé au Laboratoire</option>
                  <option value="RECEIVED">3. Reçu au Cabinet</option>
                  <option value="FITTING">4. En Cours d'Essayage</option>
                  <option value="DELIVERED">5. Posé / Livré définitif</option>
                </select>
              </div>

              {/* Lead Time Presets */}
              <div className="col-span-full flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] text-on-surface-variant font-medium">Délais rapides :</span>
                <button
                  type="button"
                  onClick={() => applyLeadTimePreset(3)}
                  className="px-2.5 py-1 rounded-lg bg-surface border border-outline-variant hover:bg-surface-container font-mono text-xs font-semibold cursor-pointer"
                >
                  Express (3j)
                </button>
                <button
                  type="button"
                  onClick={() => applyLeadTimePreset(7)}
                  className="px-2.5 py-1 rounded-lg bg-surface border border-outline-variant hover:bg-surface-container font-mono text-xs font-semibold cursor-pointer"
                >
                  Standard (7j)
                </button>
                <button
                  type="button"
                  onClick={() => applyLeadTimePreset(10)}
                  className="px-2.5 py-1 rounded-lg bg-surface border border-outline-variant hover:bg-surface-container font-mono text-xs font-semibold cursor-pointer"
                >
                  10 jours
                </button>
                <button
                  type="button"
                  onClick={() => applyLeadTimePreset(14)}
                  className="px-2.5 py-1 rounded-lg bg-surface border border-outline-variant hover:bg-surface-container font-mono text-xs font-semibold cursor-pointer"
                >
                  14 jours
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Prosthesis Type & Nature Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-on-surface flex items-center gap-1.5 uppercase tracking-wider">
              <span className="material-symbols-outlined text-secondary text-base">category</span>
              <span>4. Type & Nature de la Prothèse</span>
              <span className="text-error">*</span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <select
                  value={selectedTypeIndex}
                  onChange={(e) => handleTypeSelect(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs font-bold focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
                >
                  {PROTHESIS_TYPES.map((t, idx) => (
                    <option key={idx} value={idx}>
                      {t.label} ({t.nature})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Libellé personnalisé (optionnel)..."
                  value={customActName}
                  onChange={(e) => setCustomActName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs placeholder:text-outline focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section 5: VITA Shade Guide (Teintier Clinique) */}
          <div className="space-y-3 p-4 bg-surface-container rounded-2xl border border-outline-variant/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-on-surface flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="material-symbols-outlined text-secondary text-base">palette</span>
                  <span>5. Teinte Dentaire (Guide VITA Classical & Bleach)</span>
                  <span className="text-error">*</span>
                </label>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Reproduction chromatique précise pour l'intégration esthétique.
                </p>
              </div>

              {/* Active shade preview card */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-on-surface-variant font-medium">Teinte sélectionnée :</span>
                <span className="font-mono font-black text-sm px-3 py-1 rounded-xl bg-amber-100 text-amber-950 border-2 border-amber-400 shadow-xs">
                  {customShade.trim() || selectedShade}
                </span>
              </div>
            </div>

            {/* Filter buttons for Shade Groups */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setShadeGroupFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  shadeGroupFilter === 'ALL'
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-high'
                }`}
              >
                Toutes les teintes
              </button>
              <button
                type="button"
                onClick={() => setShadeGroupFilter('A')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  shadeGroupFilter === 'A'
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-high'
                }`}
              >
                Groupe A (Brun-Rouge)
              </button>
              <button
                type="button"
                onClick={() => setShadeGroupFilter('B')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  shadeGroupFilter === 'B'
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-high'
                }`}
              >
                Groupe B (Jaunâtre)
              </button>
              <button
                type="button"
                onClick={() => setShadeGroupFilter('C')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  shadeGroupFilter === 'C'
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-high'
                }`}
              >
                Groupe C (Grisâtre)
              </button>
              <button
                type="button"
                onClick={() => setShadeGroupFilter('D')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  shadeGroupFilter === 'D'
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-high'
                }`}
              >
                Groupe D (Gris-Rouge)
              </button>
              <button
                type="button"
                onClick={() => setShadeGroupFilter('BLEACH')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  shadeGroupFilter === 'BLEACH'
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-high'
                }`}
              >
                Bleach / 3D Master
              </button>
            </div>

            {/* Visual Color Swatches Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-2 pt-1">
              {filteredShades.map((s) => {
                const isSelected = selectedShade === s.code && !customShade.trim()
                return (
                  <button
                    key={s.code}
                    type="button"
                    aria-label={`Teinte ${s.code}`}
                    title={`Teinte ${s.code} (${s.label})`}
                    onClick={() => {
                      setSelectedShade(s.code)
                      setCustomShade('')
                    }}
                    style={{ backgroundColor: s.bgHex, color: s.textHex }}
                    className={`h-11 rounded-xl p-1 font-mono font-black text-xs transition-all flex flex-col items-center justify-center border shadow-xs cursor-pointer ${
                      isSelected
                        ? 'ring-3 ring-amber-500 border-amber-600 scale-105 z-10'
                        : 'border-slate-300 hover:scale-102 hover:border-slate-500'
                    }`}
                  >
                    <span>{s.code}</span>
                    <span className="text-[9px] font-normal opacity-75">{s.group}</span>
                  </button>
                )
              })}
            </div>

            {/* Custom Shade formula input */}
            <div className="pt-2">
              <input
                type="text"
                placeholder="Ou spécifier une formule personnalisée (ex: Collet A3.5 / Dents A2 / Bords translucides)..."
                value={customShade}
                onChange={(e) => setCustomShade(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs placeholder:text-outline focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Section 6: Financials (Lab Cost & Clinic Revenue in DA) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/60">
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface flex items-center justify-between">
                <span>Coût Facturé par le Laboratoire</span>
                <span className="font-mono text-xs text-error font-bold">DA (Dinar)</span>
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={labCostDA}
                onChange={(e) => setLabCostDA(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface font-mono font-bold text-sm focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
              />
              <span className="text-[10px] text-on-surface-variant">Dépense du cabinet due au sous-traitant</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface flex items-center justify-between">
                <span>Prix Facturé au Patient</span>
                <span className="font-mono text-xs text-secondary font-bold">DA (Dinar)</span>
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={clinicPriceDA}
                onChange={(e) => setClinicPriceDA(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface font-mono font-bold text-sm focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
              />
              <span className="text-[10px] text-on-surface-variant">
                Marge brute estimée : {(clinicPriceDA - labCostDA).toLocaleString()} DA
              </span>
            </div>
          </div>

          {/* Section 7: Clinical Notes / Lab Instructions */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
              Instructions Spéciales pour le Prothésiste
            </label>
            <textarea
              rows={3}
              placeholder="Ex: Dégagement occlusal strict, point de contact serré, profil d'émergence soigné, joint céramique supra-gingival..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface placeholder:text-outline text-xs focus:ring-2 focus:ring-secondary/40 focus:outline-hidden resize-none"
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingData}
              className="px-5 py-2.5 bg-primary-container text-on-primary hover:bg-on-secondary-fixed-variant rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">
                {existingOrder ? 'check' : 'send'}
              </span>
              <span>
                {isSubmitting
                  ? 'Enregistrement...'
                  : existingOrder
                  ? 'Mettre à jour la commande'
                  : 'Créer la Commande & Bon Labo'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
