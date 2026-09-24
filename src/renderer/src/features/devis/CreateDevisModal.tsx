import React, { useState, useEffect } from 'react'
import { Devis, DevisItem, DevisStatus, Patient, MedicalAct, DentalSpecialty } from '@shared/types'
import { devisService } from '../../services/devisService'
import { clinicalService } from '../../services/clinicalService'
import { patientService } from '../../services/patientService'
import { useToast } from '../../context/ToastContext'

interface CreateDevisModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (devis: Devis) => void
  initialPatient?: Patient | null
  existingDevis?: Devis | null
}

interface DevisDraftItem {
  id: string
  actId?: string | null
  actName: string
  specialty: string
  toothNumber?: number | null
  quantity: number
  unitPriceDA: number
  totalPriceDA: number
}

const SPECIALTY_OPTIONS: { id: DentalSpecialty; label: string }[] = [
  { id: 'ODF', label: 'Orthodontie (ODF)' },
  { id: 'IMPLANT', label: 'Implantologie' },
  { id: 'PROTHESE_FIXE', label: 'Prothèse Fixe' },
  { id: 'PROTHESE_AMOVIBLE', label: 'Prothèse Amovible' },
  { id: 'CHIRURGIE', label: 'Chirurgie Buccale' },
  { id: 'SOINS_CONSERVATEURS', label: 'Soins & Esthétique' },
  { id: 'ENDODONTIE', label: 'Endodontie' },
  { id: 'PARODONTOLOGIE', label: 'Parodontologie' }
]

export default function CreateDevisModal({
  isOpen,
  onClose,
  onSuccess,
  initialPatient,
  existingDevis
}: CreateDevisModalProps): JSX.Element | null {
  const { showToast } = useToast()

  // Data
  const [patients, setPatients] = useState<Patient[]>([])
  const [medicalActs, setMedicalActs] = useState<MedicalAct[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Form Fields
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatient?.id || '')
  const [patientSearch, setPatientSearch] = useState(
    initialPatient ? `${initialPatient.lastName} ${initialPatient.firstName}` : ''
  )
  const [dentistName, setDentistName] = useState('Dr. Mohamed Amrani')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [validityDays, setValidityDays] = useState(30)
  const [status, setStatus] = useState<DevisStatus>('SENT')
  const [discountDA, setDiscountDA] = useState<number>(0)
  const [notes, setNotes] = useState(
    'Devis préalable établi avant réalisation des soins. Modalités de règlement : facilités de paiement sur accord préalable.'
  )

  // Items List
  const [items, setItems] = useState<DevisDraftItem[]>([])

  // Current item builder fields
  const [selectedActId, setSelectedActId] = useState<string>('')
  const [customActName, setCustomActName] = useState<string>('')
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('PROTHESE_FIXE')
  const [toothNumber, setToothNumber] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [unitPriceDA, setUnitPriceDA] = useState<number>(0)

  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const loadInit = async (): Promise<void> => {
      setIsLoadingData(true)
      try {
        const [pats, acts] = await Promise.all([
          patientService.getPatients(),
          clinicalService.getMedicalActs()
        ])
        setPatients(pats)
        setMedicalActs(acts)

        if (existingDevis) {
          setSelectedPatientId(existingDevis.patientId)
          const p = pats.find((item) => item.id === existingDevis.patientId)
          if (p) setPatientSearch(`${p.lastName} ${p.firstName}`)
          setDentistName(existingDevis.dentistName || 'Dr. Mohamed Amrani')
          setDate(existingDevis.date ? existingDevis.date.slice(0, 10) : new Date().toISOString().slice(0, 10))
          setValidityDays(existingDevis.validityDays || 30)
          setStatus(existingDevis.status)
          setDiscountDA(existingDevis.discountDA || 0)
          setNotes(existingDevis.notes || '')
          if (existingDevis.items && existingDevis.items.length > 0) {
            setItems(
              existingDevis.items.map((i) => ({
                id: i.id || `item_${Date.now()}_${Math.random()}`,
                actId: i.actId,
                actName: i.actName,
                specialty: i.specialty,
                toothNumber: i.toothNumber,
                quantity: i.quantity || 1,
                unitPriceDA: i.unitPriceDA || 0,
                totalPriceDA: i.totalPriceDA || (i.unitPriceDA * (i.quantity || 1))
              }))
            )
          }
        } else if (initialPatient) {
          setSelectedPatientId(initialPatient.id)
          setPatientSearch(`${initialPatient.lastName} ${initialPatient.firstName}`)
        }
      } catch (err) {
        console.error('Error loading devis dependencies:', err)
      } finally {
        setIsLoadingData(false)
      }
    }
    loadInit()
  }, [isOpen, initialPatient, existingDevis])

  // When an act is chosen from the catalog, auto-fill specialty and unit price
  const handleSelectAct = (actId: string): void => {
    setSelectedActId(actId)
    if (!actId) {
      setCustomActName('')
      setUnitPriceDA(0)
      return
    }
    const act = medicalActs.find((a) => a.id === actId)
    if (act) {
      setCustomActName(act.name)
      setSelectedSpecialty((act.specialty || act.category || 'SOINS_CONSERVATEURS') as string)
      setUnitPriceDA(act.defaultPriceDA || act.defaultPrice || 0)
    }
  }

  // Add Item to draft
  const handleAddItem = (e: React.FormEvent): void => {
    e.preventDefault()
    const effectiveName = customActName.trim()
    if (!effectiveName) {
      showToast("Veuillez saisir ou choisir l'acte médical", 'error')
      return
    }
    if (unitPriceDA < 0 || quantity <= 0) {
      showToast('Le prix et la quantité doivent être valides', 'error')
      return
    }

    const newItem: DevisDraftItem = {
      id: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      actId: selectedActId || null,
      actName: effectiveName,
      specialty: selectedSpecialty,
      toothNumber: toothNumber.trim() ? parseInt(toothNumber.trim(), 10) : null,
      quantity: Number(quantity) || 1,
      unitPriceDA: Number(unitPriceDA) || 0,
      totalPriceDA: (Number(unitPriceDA) || 0) * (Number(quantity) || 1)
    }

    setItems((prev) => [...prev, newItem])
    // Reset item builder
    setSelectedActId('')
    setCustomActName('')
    setToothNumber('')
    setQuantity(1)
    setUnitPriceDA(0)
    showToast('Acte ajouté au devis', 'info')
  }

  const handleRemoveItem = (id: string): void => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  // Totals calculations
  const totalGrossDA = items.reduce((acc, curr) => acc + curr.totalPriceDA, 0)
  const totalNetDA = Math.max(0, totalGrossDA - (Number(discountDA) || 0))

  // Submit Devis
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    if (!selectedPatientId) {
      showToast('Veuillez sélectionner un patient', 'error')
      return
    }
    if (items.length === 0) {
      showToast('Veuillez ajouter au moins un acte au devis', 'error')
      return
    }

    const patient = patients.find((p) => p.id === selectedPatientId) || initialPatient

    setIsSubmitting(true)
    try {
      const saved = await devisService.saveDevis(
        {
          ...(existingDevis?.id ? { id: existingDevis.id } : {}),
          ...(existingDevis?.devisNumber ? { devisNumber: existingDevis.devisNumber } : {}),
          patientId: selectedPatientId,
          patientName: patient ? `${patient.lastName} ${patient.firstName}` : 'Patient',
          dentistName: dentistName || 'Dr. Mohamed Amrani',
          date,
          validityDays: Number(validityDays) || 30,
          totalGrossDA,
          discountDA: Number(discountDA) || 0,
          totalNetDA,
          status,
          notes: notes.trim() || null
        },
        items.map((i) => ({
          actId: i.actId,
          actName: i.actName,
          specialty: i.specialty,
          toothNumber: i.toothNumber,
          quantity: i.quantity,
          unitPriceDA: i.unitPriceDA,
          totalPriceDA: i.totalPriceDA
        }))
      )

      showToast(
        existingDevis
          ? `Devis ${saved.devisNumber} mis à jour avec succès`
          : `Devis officiel ${saved.devisNumber} créé avec succès`,
        'success'
      )
      onSuccess(saved)
      onClose()
    } catch (err: any) {
      showToast(`Erreur enregistrement devis : ${err?.message || 'Erreur'}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const filteredPatients = patients.filter((p) =>
    `${p.lastName} ${p.firstName} ${p.patientNumber}`
      .toLowerCase()
      .includes(patientSearch.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface-container-lowest text-on-surface w-full max-w-4xl rounded-2xl shadow-2xl border border-outline-variant/60 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-surface-container-high border-b border-outline-variant/60 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-secondary text-2xl">request_quote</span>
            <div>
              <h2 className="text-base font-bold text-on-surface">
                {existingDevis ? `Modifier Devis ${existingDevis.devisNumber}` : 'Nouveau Devis Estimatif Officiel'}
              </h2>
              <p className="text-xs text-on-surface-variant">
                Proposition financière préalable en Dinars Algériens (DA) — Indépendante de la facturation
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-sm max-h-[82vh] overflow-y-auto">
          {/* Row 1: Patient, Dentist, Date, Validity */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/60">
            {/* Patient Search */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-bold text-on-surface flex items-center gap-1">
                <span>Patient Concerné</span>
                <span className="text-error">*</span>
              </label>
              {initialPatient ? (
                <div className="p-2 rounded-xl bg-surface border border-outline-variant/60 font-semibold text-xs flex items-center justify-between">
                  <span>{initialPatient.lastName.toUpperCase()} {initialPatient.firstName}</span>
                  <span className="font-mono text-secondary text-[11px] px-2 py-0.5 rounded bg-surface-container">
                    {initialPatient.patientNumber}
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Chercher patient par nom, prénom ou N° dossier..."
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value)
                      setSelectedPatientId('')
                    }}
                    className="w-full px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
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

            {/* Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface">Date du Devis</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs font-mono"
              />
            </div>

            {/* Validity */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface">Validité de l'Offre</label>
              <select
                value={validityDays}
                onChange={(e) => setValidityDays(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs font-semibold"
              >
                <option value={15}>15 jours</option>
                <option value={30}>30 jours (Standard)</option>
                <option value={60}>60 jours</option>
                <option value={90}>90 jours</option>
              </select>
            </div>
          </div>

          {/* Row 2: Add Treatment / Act Sub-form */}
          <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface flex items-center gap-1.5 uppercase tracking-wide">
                <span className="material-symbols-outlined text-secondary text-base">add_box</span>
                <span>Ajouter un Acte ou Traitement au Devis</span>
              </span>
              <span className="text-[11px] text-on-surface-variant font-medium">
                Bibliothèque d'actes dentaires algériens
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              {/* Act catalog selector */}
              <div className="sm:col-span-4 space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant block">
                  Sélectionner dans le Catalogue
                </label>
                <select
                  value={selectedActId}
                  onChange={(e) => handleSelectAct(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs"
                >
                  <option value="">-- Acte personnalisé libre --</option>
                  {medicalActs.map((act) => (
                    <option key={act.id} value={act.id}>
                      [{act.specialty}] {act.name} ({act.defaultPriceDA?.toLocaleString()} DA)
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom act name / label */}
              <div className="sm:col-span-3 space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant block">
                  Désignation de l'acte *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Couronne Zircone, Pose d'implant..."
                  value={customActName}
                  onChange={(e) => setCustomActName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs"
                />
              </div>

              {/* Tooth Number */}
              <div className="sm:col-span-1 space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant block">
                  Dent
                </label>
                <input
                  type="number"
                  placeholder="FDI"
                  min={11}
                  max={85}
                  value={toothNumber}
                  onChange={(e) => setToothNumber(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs font-mono font-bold text-center"
                />
              </div>

              {/* Quantity */}
              <div className="sm:col-span-1 space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant block">
                  Qté
                </label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs font-bold text-center"
                />
              </div>

              {/* Unit Price DA */}
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant block">
                  Prix Unit. (DA)
                </label>
                <input
                  type="number"
                  step={500}
                  min={0}
                  value={unitPriceDA}
                  onChange={(e) => setUnitPriceDA(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs font-mono font-bold"
                />
              </div>

              {/* Add Button */}
              <div className="sm:col-span-1">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full py-1.5 bg-secondary text-white rounded-xl text-xs font-bold hover:bg-secondary/90 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                  title="Ajouter au tableau du devis"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Items Table */}
          <div className="border border-outline-variant/60 rounded-2xl overflow-hidden bg-surface-container-lowest shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-high/60 border-b border-outline-variant/40 text-on-surface-variant font-semibold">
                  <th className="py-2.5 px-4 w-12 text-center">Dent</th>
                  <th className="py-2.5 px-4">Désignation du Traitement</th>
                  <th className="py-2.5 px-4">Spécialité</th>
                  <th className="py-2.5 px-3 text-center">Qté</th>
                  <th className="py-2.5 px-4 text-right">Prix Unitaire</th>
                  <th className="py-2.5 px-4 text-right">Total (DA)</th>
                  <th className="py-2.5 px-3 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-3xl text-outline mb-1">
                        post_add
                      </span>
                      <p className="font-semibold text-xs">Aucun acte ajouté au devis</p>
                      <p className="text-[11px] text-outline mt-0.5">
                        Utilisez le formulaire ci-dessus pour composer votre proposition financière
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-secondary">
                        {item.toothNumber ? (
                          <span className="w-6 h-6 rounded-md bg-secondary/10 inline-flex items-center justify-center">
                            {item.toothNumber}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-on-surface">{item.actName}</td>
                      <td className="py-2.5 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                          {item.specialty}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">{item.quantity}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium">
                        {item.unitPriceDA.toLocaleString()} DA
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-on-surface">
                        {item.totalPriceDA.toLocaleString()} DA
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 rounded-lg text-outline hover:text-error hover:bg-error-container/30 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Row 4: Financial Summary & Discount in DA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface">Statut du Devis</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DevisStatus)}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-xs font-bold"
              >
                <option value="DRAFT">1. DRAFT (Projet / Brouillon)</option>
                <option value="SENT">2. SENT (Remis au patient)</option>
                <option value="ACCEPTED">3. ACCEPTED (Accepté par le patient)</option>
                <option value="REJECTED">4. REJECTED (Refusé / Sans suite)</option>
              </select>

              <label className="text-xs font-bold text-on-surface block pt-1">
                Conditions & Modalités Particulières
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-xs resize-none"
              />
            </div>

            {/* Calculations Box */}
            <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/60 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-medium">Total Brut (Somme des actes) :</span>
                <span className="font-mono font-bold text-on-surface">
                  {totalGrossDA.toLocaleString()} DA
                </span>
              </div>

              <div className="flex justify-between items-center text-xs pt-1 border-t border-outline-variant/30">
                <span className="text-on-surface-variant font-medium flex items-center gap-1">
                  <span>Remise accordée (DA) :</span>
                </span>
                <div className="flex items-center gap-1.5 w-36">
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={discountDA}
                    onChange={(e) => setDiscountDA(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded-lg border border-outline-variant bg-surface text-xs font-mono font-bold text-right text-error"
                  />
                  <span className="text-[11px] text-on-surface-variant font-bold">DA</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm pt-2 border-t border-outline-variant/60">
                <span className="font-black text-on-surface">Net à Payer (Total Devis) :</span>
                <span className="font-mono font-black text-lg text-secondary">
                  {totalNetDA.toLocaleString()} DA
                </span>
              </div>
            </div>
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
                {existingDevis ? 'save' : 'post_add'}
              </span>
              <span>
                {isSubmitting
                  ? 'Enregistrement...'
                  : existingDevis
                  ? 'Mettre à jour le Devis'
                  : 'Générer le Devis Officiel'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
