import React, { useState, useEffect } from 'react'
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

const VITA_CLASSICAL_SHADES = [
  'A1', 'A2', 'A3', 'A3.5', 'A4',
  'B1', 'B2', 'B3', 'B4',
  'C1', 'C2', 'C3', 'C4',
  'D2', 'D3', 'D4'
]

const BLEACH_3D_SHADES = [
  'BL1', 'BL2', 'BL3', 'BL4',
  '1M1', '2M2', '3M2', '2L1.5', '3R2.5'
]

const PROTHESIS_TYPES: { label: string; nature: ProthesisNature; defaultLabCostDA: number; defaultClinicPriceDA: number }[] = [
  { label: 'Couronne Zircone Monolithique', nature: 'ZIRCONE', defaultLabCostDA: 9000, defaultClinicPriceDA: 25000 },
  { label: 'Couronne Céramo-Métallique (CCM)', nature: 'CERAMO_METALLIQUE', defaultLabCostDA: 5000, defaultClinicPriceDA: 15000 },
  { label: 'Couronne E.max Céramique pure', nature: 'EMAX', defaultLabCostDA: 11000, defaultClinicPriceDA: 30000 },
  { label: 'Facette Céramique E.max', nature: 'EMAX', defaultLabCostDA: 12000, defaultClinicPriceDA: 35000 },
  { label: 'Inlay / Onlay E.max', nature: 'INLAY_ONLAY', defaultLabCostDA: 7500, defaultClinicPriceDA: 18000 },
  { label: 'Bridge Céramo-Métallique (par inter)', nature: 'CERAMO_METALLIQUE', defaultLabCostDA: 5000, defaultClinicPriceDA: 15000 },
  { label: 'Bridge Zircone (par inter)', nature: 'ZIRCONE', defaultLabCostDA: 9000, defaultClinicPriceDA: 25000 },
  { label: 'Châssis Métallique Stellite', nature: 'STELLITE', defaultLabCostDA: 16000, defaultClinicPriceDA: 45000 },
  { label: 'Prothèse Résine Complète (1 arcade)', nature: 'RESINE_COMPLETE', defaultLabCostDA: 12000, defaultClinicPriceDA: 30000 },
  { label: 'Prothèse Partielle Résine (1-3 dents)', nature: 'RESINE_PARTIELLE', defaultLabCostDA: 4000, defaultClinicPriceDA: 12000 },
  { label: 'Couronne sur Implant (Zircone transvissée)', nature: 'ZIRCONE', defaultLabCostDA: 15000, defaultClinicPriceDA: 45000 },
  { label: 'Gouttière thermoformée / de bruxisme', nature: 'GOUTTIERE', defaultLabCostDA: 3000, defaultClinicPriceDA: 8000 }
]

export default function NewProthesisOrderModal({
  isOpen,
  onClose,
  onSuccess,
  initialPatient,
  existingOrder
}: NewProthesisOrderModalProps): JSX.Element | null {
  const { showToast } = useToast()

  // Data sources
  const [patients, setPatients] = useState<Patient[]>([])
  const [labs, setLabs] = useState<ProstheticLaboratory[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Form Fields
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatient?.id || '')
  const [patientSearch, setPatientSearch] = useState(
    initialPatient ? `${initialPatient.lastName} ${initialPatient.firstName}` : ''
  )
  const [selectedLabId, setSelectedLabId] = useState('')
  const [dentistName, setDentistName] = useState('Dr. Mohamed Amrani')
  const [selectedTypeIndex, setSelectedTypeIndex] = useState(0)
  const [customActName, setCustomActName] = useState('')
  const [toothNumber, setToothNumber] = useState<string>('')
  const [shade, setShade] = useState('A2')
  const [customShade, setCustomShade] = useState('')
  const [status, setStatus] = useState<ProthesisOrderStatus>('SENT')
  const [sentDate, setSentDate] = useState(new Date().toISOString().slice(0, 10))
  const [expectedDate, setExpectedDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7) // +7 days standard lead time
    return d.toISOString().slice(0, 10)
  })
  const [labCostDA, setLabCostDA] = useState<number>(PROTHESIS_TYPES[0].defaultLabCostDA)
  const [clinicPriceDA, setClinicPriceDA] = useState<number>(PROTHESIS_TYPES[0].defaultClinicPriceDA)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Quick New Lab Modal inline state
  const [showQuickAddLab, setShowQuickAddLab] = useState(false)
  const [newLabName, setNewLabName] = useState('')
  const [newLabPhone, setNewLabPhone] = useState('')
  const [newLabWilaya, setNewLabWilaya] = useState('Alger')

  // Load patients and labs on mount/open
  useEffect(() => {
    if (!isOpen) return
    const fetchDependencies = async (): Promise<void> => {
      setIsLoadingData(true)
      try {
        const [pats, availableLabs] = await Promise.all([
          patientService.getPatients(),
          prothesisService.getLabs()
        ])
        setPatients(pats)
        setLabs(availableLabs)

        if (existingOrder) {
          setSelectedPatientId(existingOrder.patientId)
          const p = pats.find((item) => item.id === existingOrder.patientId)
          if (p) setPatientSearch(`${p.lastName} ${p.firstName}`)
          setSelectedLabId(existingOrder.labId)
          setDentistName(existingOrder.dentistName || 'Dr. Mohamed Amrani')
          setToothNumber(existingOrder.toothNumber ? String(existingOrder.toothNumber) : '')
          setShade(existingOrder.shade || 'A2')
          setStatus(existingOrder.status)
          setSentDate(existingOrder.sentDate ? existingOrder.sentDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
          setExpectedDate(existingOrder.expectedDate ? existingOrder.expectedDate.slice(0, 10) : '')
          setLabCostDA(existingOrder.labCostDA || 0)
          setClinicPriceDA(existingOrder.clinicPriceDA || 0)
          setNotes(existingOrder.notes || '')
          setCustomActName(existingOrder.actName)
        } else {
          if (initialPatient) {
            setSelectedPatientId(initialPatient.id)
            setPatientSearch(`${initialPatient.lastName} ${initialPatient.firstName}`)
          }
          if (availableLabs.length > 0) {
            setSelectedLabId(availableLabs[0].id)
          }
        }
      } catch (err) {
        console.error('Error fetching dependencies for Prothesis Modal:', err)
      } finally {
        setIsLoadingData(false)
      }
    }
    fetchDependencies()
  }, [isOpen, initialPatient, existingOrder])

  // When changing type, update default prices unless existing order
  const handleTypeSelect = (idx: number): void => {
    setSelectedTypeIndex(idx)
    const t = PROTHESIS_TYPES[idx]
    if (!existingOrder) {
      setLabCostDA(t.defaultLabCostDA)
      setClinicPriceDA(t.defaultClinicPriceDA)
    }
  }

  // Quick add lab
  const handleCreateQuickLab = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newLabName.trim()) {
      showToast('Le nom du laboratoire est obligatoire', 'error')
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
      showToast(`Erreur ajout labo : ${err?.message || 'Erreur'}`, 'error')
    }
  }

  // Submit order
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    if (!selectedPatientId) {
      showToast('Veuillez sélectionner un patient valide', 'error')
      return
    }
    if (!selectedLabId) {
      showToast('Veuillez sélectionner un laboratoire prothétique', 'error')
      return
    }

    const effectiveShade = customShade.trim() || shade
    if (!effectiveShade) {
      showToast('La sélection de la teinte (couleur) est obligatoire', 'error')
      return
    }

    const patient = patients.find((p) => p.id === selectedPatientId) || initialPatient
    const lab = labs.find((l) => l.id === selectedLabId)

    const selectedType = PROTHESIS_TYPES[selectedTypeIndex]
    const actName = customActName.trim() || selectedType.label
    const nature = selectedType.nature

    setIsSubmitting(true)
    try {
      const saved = await prothesisService.saveOrder({
        ...(existingOrder?.id ? { id: existingOrder.id } : {}),
        ...(existingOrder?.orderNumber ? { orderNumber: existingOrder.orderNumber } : {}),
        patientId: selectedPatientId,
        patientName: patient ? `${patient.lastName} ${patient.firstName}` : 'Patient',
        dentistName: dentistName || 'Dr. Mohamed Amrani',
        labId: selectedLabId,
        labName: lab?.name || 'Laboratoire',
        actName,
        nature,
        toothNumber: toothNumber.trim() ? parseInt(toothNumber.trim(), 10) : null,
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
          ? `Commande ${saved.orderNumber} mise à jour avec succès`
          : `Nouvelle commande ${saved.orderNumber} enregistrée avec succès`,
        'success'
      )
      onSuccess(saved)
      onClose()
    } catch (err: any) {
      showToast(`Erreur enregistrement commande : ${err?.message || 'Erreur inconnue'}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  // Filter patients for search dropdown
  const filteredPatients = patients.filter((p) =>
    `${p.lastName} ${p.firstName} ${p.patientNumber}`
      .toLowerCase()
      .includes(patientSearch.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface-container-lowest text-on-surface w-full max-w-3xl rounded-2xl shadow-2xl border border-outline-variant/60 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-surface-container-high border-b border-outline-variant/60 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-secondary text-2xl">
              precision_manufacturing
            </span>
            <div>
              <h2 className="text-base font-bold text-on-surface">
                {existingOrder ? `Modifier Commande ${existingOrder.orderNumber}` : 'Nouvelle Commande de Prothèse Dentaire'}
              </h2>
              <p className="text-xs text-on-surface-variant">
                Envoi d'empreinte & Fiche navette laboratoire de prothèse (Algérie)
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-sm max-h-[80vh] overflow-y-auto">
          {/* Row 1: Patient Selection & Laboratory */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Patient Search */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface flex items-center gap-1">
                <span>Patient Concerné</span>
                <span className="text-error">*</span>
              </label>
              {initialPatient ? (
                <div className="p-2.5 rounded-xl bg-surface-container border border-outline-variant/60 font-semibold text-on-surface flex items-center justify-between">
                  <span>{initialPatient.lastName.toUpperCase()} {initialPatient.firstName}</span>
                  <span className="text-xs font-mono text-secondary px-2 py-0.5 rounded bg-surface-container-highest">
                    {initialPatient.patientNumber}
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Taper le nom ou N° dossier..."
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value)
                      setSelectedPatientId('')
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface placeholder:text-outline text-xs focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
                  />
                  {patientSearch && !selectedPatientId && filteredPatients.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-surface-container-high border border-outline-variant rounded-xl shadow-lg divide-y divide-outline-variant/30">
                      {filteredPatients.slice(0, 6).map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedPatientId(p.id)
                            setPatientSearch(`${p.lastName} ${p.firstName}`)
                          }}
                          className="px-3 py-2 text-xs hover:bg-surface-container cursor-pointer flex justify-between items-center"
                        >
                          <span className="font-semibold">{p.lastName} {p.firstName}</span>
                          <span className="font-mono text-[11px] text-secondary">{p.patientNumber}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Laboratory Selection */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-on-surface flex items-center gap-1">
                  <span>Laboratoire de Prothèse</span>
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
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
              >
                <option value="" disabled>Sélectionner un laboratoire...</option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.name} ({lab.wilaya || 'Alger'}) — {lab.phone}
                  </option>
                ))}
              </select>
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

          {/* Row 2: Prosthesis Type & Tooth Number */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-bold text-on-surface">
                Type de Prothèse / Acte
              </label>
              <select
                value={selectedTypeIndex}
                onChange={(e) => handleTypeSelect(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs font-medium focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
              >
                {PROTHESIS_TYPES.map((t, idx) => (
                  <option key={idx} value={idx}>
                    {t.label} ({t.nature})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface flex items-center justify-between">
                <span>N° Dent (FDI)</span>
                <span className="text-[10px] text-on-surface-variant font-normal">Ex: 11, 21, 36...</span>
              </label>
              <input
                type="number"
                placeholder="Facultatif (ex: 21)"
                value={toothNumber}
                onChange={(e) => setToothNumber(e.target.value)}
                min={11}
                max={85}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface font-mono font-bold text-xs focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Row 3: Mandatory Tooth Shade (Teinte) Picker */}
          <div className="space-y-2 p-4 bg-surface-container rounded-2xl border border-outline-variant/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-base">palette</span>
                <span>Choix du Teintier Clinique (Teinte / Shade)</span>
                <span className="text-error">*</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-on-surface-variant font-medium">Teinte active:</span>
                <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                  {customShade.trim() || shade}
                </span>
              </div>
            </div>

            {/* Vita Classical Shades Grid */}
            <div>
              <p className="text-[11px] font-bold text-on-surface-variant mb-1.5">
                Guide VITA Classical :
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VITA_CLASSICAL_SHADES.map((s) => {
                  const isSelected = shade === s && !customShade.trim()
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setShade(s)
                        setCustomShade('')
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-600 shadow-xs scale-105'
                          : 'bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Bleach & 3D Master Grid */}
            <div className="pt-2 border-t border-outline-variant/40">
              <p className="text-[11px] font-bold text-on-surface-variant mb-1.5">
                Teintes Blanchiment (Bleach) & 3D-Master :
              </p>
              <div className="flex flex-wrap gap-1.5">
                {BLEACH_3D_SHADES.map((s) => {
                  const isSelected = shade === s && !customShade.trim()
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setShade(s)
                        setCustomShade('')
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-secondary text-on-secondary ring-2 ring-secondary/50 shadow-xs scale-105'
                          : 'bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom Shade formula input */}
            <div className="pt-2">
              <input
                type="text"
                placeholder="Ou spécifier une formule personnalisée (ex: Collet A3.5 / Dents A2 / Translucide)..."
                value={customShade}
                onChange={(e) => setCustomShade(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs placeholder:text-outline focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Row 4: Timeline & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <label className="text-xs font-bold text-on-surface">Date Réception Souhaitée</label>
              <input
                type="date"
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
                <option value="RECEIVED">3. Reçu du Laboratoire</option>
                <option value="FITTING">4. En Cours d'Essayage</option>
                <option value="DELIVERED">5. Posé / Livré définitif</option>
              </select>
            </div>
          </div>

          {/* Row 5: Financials (Lab Cost & Clinic Revenue in DA) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/60">
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface flex items-center justify-between">
                <span>Coût Facturé par le Labo</span>
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
              <span className="text-[10px] text-on-surface-variant">Dépense du cabinet due au prothésiste</span>
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

          {/* Row 6: Clinical Notes / Lab Instructions */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface">
              Instructions Spéciales pour le Prothésiste
            </label>
            <textarea
              rows={3}
              placeholder="Ex: Dégagement occlusal strict, point de contact serré, profil d'émergence soigné, joint céramique supra-gingival..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface placeholder:text-outline text-xs focus:ring-2 focus:ring-secondary/40 focus:outline-hidden resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-end gap-3">
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
                  ? 'Mettre à jour'
                  : 'Créer la Commande & Bon Labo'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
