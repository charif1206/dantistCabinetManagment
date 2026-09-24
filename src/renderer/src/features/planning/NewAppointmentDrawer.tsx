import React, { useState, useEffect } from 'react'
import { Appointment, Patient } from '@shared/types'
import { appointmentService } from '../../services/appointmentService'
import { patientService } from '../../services/patientService'
import { validateFutureDateTime } from '../../utils/validators'
import { useToast } from '../../context/ToastContext'
import ConflictAlertModal from './ConflictAlertModal'

interface NewAppointmentDrawerProps {
  initialDate?: string
  onClose: () => void
  onSuccess: () => void
}

const CLINIC_DENTISTS = [
  'Dr. Mohamed Amrani',
  'Dr. Sarah Benali',
  'Dr. Walid Mansouri'
]

export default function NewAppointmentDrawer({
  initialDate,
  onClose,
  onSuccess
}: NewAppointmentDrawerProps): JSX.Element {
  const { showToast } = useToast()

  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')
  const [patientSearch, setPatientSearch] = useState<string>('')
  const [manualName, setManualName] = useState<string>('Yacine Benali')
  const [manualPhone, setManualPhone] = useState<string>('0555123456')

  const [dateTime, setDateTime] = useState<string>(() => {
    if (initialDate) {
      return initialDate.includes('T') ? initialDate.slice(0, 16) : `${initialDate}T10:00`
    }
    const d = new Date()
    d.setDate(d.getDate() + 1) // Tomorrow at 10:00 AM
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}T10:00`
  })

  const [durationMinutes, setDurationMinutes] = useState<number>(30)
  const [treatmentType, setTreatmentType] = useState<string>('Consultation de contrôle')
  const [dentistName, setDentistName] = useState<string>('Dr. Mohamed Amrani')
  const [notes, setNotes] = useState<string>('Visite de contrôle semestrielle et détartrage ultra-sons')

  // Validation errors
  const [dateTimeError, setDateTimeError] = useState<string>('')
  const [patientError, setPatientError] = useState<string>('')

  // Conflict state
  const [conflictingAppointment, setConflictingAppointment] = useState<Appointment | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    patientService.getPatients().then((list) => {
      setPatients(list)
      if (list.length > 0 && !selectedPatientId) {
        setSelectedPatientId(list[0].id)
      }
    }).catch(console.error)
  }, [])

  // Live validate dateTime on blur
  const handleDateTimeBlur = (): void => {
    const res = validateFutureDateTime(dateTime)
    if (!res.isValid) {
      setDateTimeError(res.error || "La date et l'heure du rendez-vous doivent être strictement ultérieures au moment actuel.")
    } else {
      setDateTimeError('')
    }
  }

  // Filter patients by name, patientNumber, phone, cin
  const filteredPatients = patients.filter((p) => {
    const q = patientSearch.toLowerCase().trim()
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      p.patientNumber.toLowerCase().includes(q) ||
      (p.cin && p.cin.toLowerCase().includes(q))
    )
  })

  const selectedPatient = patients.find((p) => p.id === selectedPatientId)

  const executeSave = async (): Promise<void> => {
    setIsSubmitting(true)
    try {
      const patientName = selectedPatient
        ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
        : manualName.trim() || 'Patient Inconnu'
      const patientPhone = selectedPatient ? selectedPatient.phone : manualPhone.trim()
      const patientId = selectedPatientId || 'quick_patient'

      await appointmentService.saveAppointment({
        patientId,
        patientName,
        patientPhone,
        dateTime: new Date(dateTime).toISOString(),
        durationMinutes,
        treatmentType,
        status: 'SCHEDULED',
        dentistName,
        notes
      })

      showToast(`Rendez-vous confirmé pour ${patientName} le ${dateTime.replace('T', ' à ')}`, 'success')
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Failed to save appointment:', err)
      showToast("Erreur lors de l'enregistrement du rendez-vous", 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleValidateAndSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    // 1. Validate Patient
    if (!selectedPatientId && !manualName.trim()) {
      setPatientError('Veuillez sélectionner un patient ou saisir son nom.')
      showToast('Veuillez désigner un patient pour ce rendez-vous.', 'error')
      return
    }
    setPatientError('')

    // 2. Validate Future Date & Time (Past Date Blocking)
    const dateRes = validateFutureDateTime(dateTime)
    if (!dateRes.isValid) {
      setDateTimeError(dateRes.error || "La date et l'heure du rendez-vous doivent être strictement ultérieures au moment actuel.")
      showToast(
        'Impossible de programmer un rendez-vous dans le passé. Veuillez choisir une date et heure future.',
        'error'
      )
      return
    }
    setDateTimeError('')

    // 3. Conflict Detection Engine (for same practitioner)
    const newStart = new Date(dateTime).getTime()
    const newEnd = newStart + durationMinutes * 60 * 1000

    try {
      const allApts = await appointmentService.getAppointments()
      const conflict = allApts.find((a) => {
        if (a.status === 'CANCELLED') return false

        // Check if same dentist
        const isSameDentist = (a.dentistName || 'Dr. Mohamed Amrani') === dentistName
        if (!isSameDentist) return false

        const aStart = new Date(a.dateTime).getTime()
        const aEnd = aStart + (a.durationMinutes || 30) * 60 * 1000

        // Interval intersection check
        return newStart < aEnd && newEnd > aStart
      })

      if (conflict) {
        setConflictingAppointment(conflict)
        showToast(`Attention : Conflit d'horaire détecté pour ${dentistName} sur ce créneau.`, 'warning')
        return
      }

      await executeSave()
    } catch (err) {
      console.error('Conflict check error:', err)
      await executeSave()
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex justify-end">
      <div className="w-full sm:w-[460px] bg-surface-container-lowest h-full flex flex-col shadow-2xl border-l border-outline-variant animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant/60 flex items-center justify-between bg-surface-container-low shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-secondary text-2xl">event</span>
            <div>
              <h2 className="font-bold text-base text-on-surface">Nouveau Rendez-vous</h2>
              <span className="text-xs text-on-surface-variant font-medium">Contrôle de conformité & Conflits</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleValidateAndSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Patient Selection */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Patient <span className="text-error">*</span>
            </label>
            <div className="relative mb-2">
              <input
                type="text"
                placeholder="Rechercher par nom, tél, N° dossier DZ-2026-XXXX..."
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value)
                  if (patientError) setPatientError('')
                }}
                className={`w-full h-10 pl-9 pr-3 rounded-xl bg-surface border text-xs text-on-surface focus:outline-none ${
                  patientError ? 'border-error focus:border-error' : 'border-outline-variant focus:border-secondary'
                }`}
              />
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-base">
                search
              </span>
            </div>

            {patientSearch && (
              <div className="max-h-40 overflow-y-auto border border-outline-variant/60 rounded-xl bg-surface divide-y divide-outline-variant/30 mb-2 shadow-xs">
                {filteredPatients.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatientId(p.id)
                      setPatientSearch('')
                      setPatientError('')
                    }}
                    className="w-full text-left p-2.5 hover:bg-secondary-fixed/30 text-xs flex justify-between items-center transition-colors cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-on-surface">{p.firstName} {p.lastName}</span>
                      <span className="text-outline text-[11px] ml-2">({p.phone})</span>
                    </div>
                    <span className="font-mono text-[10px] text-secondary font-bold">{p.patientNumber}</span>
                  </button>
                ))}
              </div>
            )}

            {selectedPatient ? (
              <div className="p-3 rounded-xl bg-secondary-fixed/30 border border-secondary/30 flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-on-surface">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </div>
                  <div className="text-[11px] text-on-surface-variant font-mono">
                    {selectedPatient.patientNumber} · Tél: {selectedPatient.phone}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPatientId('')}
                  className="text-xs font-semibold text-secondary hover:underline cursor-pointer"
                >
                  Changer
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <span className="text-[11px] text-on-surface-variant block font-medium">
                  Ou enregistrer un patient de passage rapide :
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Nom & Prénom *"
                    value={manualName}
                    onChange={(e) => {
                      setManualName(e.target.value)
                      if (patientError) setPatientError('')
                    }}
                    className={`h-10 px-3 rounded-xl bg-surface border text-xs text-on-surface ${
                      patientError ? 'border-error' : 'border-outline-variant'
                    }`}
                  />
                  <input
                    type="text"
                    placeholder="N° Téléphone (05/06/07)"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface"
                  />
                </div>
              </div>
            )}

            {patientError && (
              <p className="text-[11px] text-error font-medium mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">error</span>
                <span>{patientError}</span>
              </p>
            )}
          </div>

          {/* Practitioner (Doctor Selector) */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Chirurgien-Dentiste traitant <span className="text-error">*</span>
            </label>
            <select
              value={dentistName}
              onChange={(e) => setDentistName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface font-semibold focus:outline-none focus:border-secondary cursor-pointer"
            >
              {CLINIC_DENTISTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Treatment Type */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Motif du Rendez-vous <span className="text-error">*</span>
            </label>
            <select
              value={treatmentType}
              onChange={(e) => setTreatmentType(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface font-medium cursor-pointer"
            >
              <option value="Consultation de contrôle">Consultation de contrôle</option>
              <option value="Urgence dentaire (Douleur)">Urgence dentaire (Douleur)</option>
              <option value="Détartrage & Polissage">Détartrage & Polissage</option>
              <option value="Soin conservateur (Composite)">Soin conservateur (Composite)</option>
              <option value="Traitement Endodontique">Traitement Endodontique</option>
              <option value="Extraction dentaire">Extraction dentaire</option>
              <option value="Pose Prothèse / Couronne">Pose Prothèse / Couronne</option>
              <option value="Contrôle post-opératoire">Contrôle post-opératoire</option>
            </select>
          </div>

          {/* Date, Time & Duration */}
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                  Date & Heure <span className="text-error">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={dateTime}
                  onBlur={handleDateTimeBlur}
                  onChange={(e) => {
                    setDateTime(e.target.value)
                    const res = validateFutureDateTime(e.target.value)
                    setDateTimeError(res.isValid ? '' : res.error || '')
                  }}
                  className={`w-full h-10 px-2 rounded-xl bg-surface border text-xs text-on-surface focus:outline-none ${
                    dateTimeError ? 'border-error focus:border-error ring-1 ring-error/50' : 'border-outline-variant focus:border-secondary'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                  Durée prévue
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface cursor-pointer"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 heure</option>
                  <option value={90}>1h 30 min</option>
                </select>
              </div>
            </div>

            {/* Error Message under DateTime field */}
            {dateTimeError && (
              <p className="text-[11px] text-error font-medium mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">error</span>
                <span>{dateTimeError}</span>
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Instructions / Remarques pour le praticien
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Patient anxieux, antécédents d'allergie, prévoir anesthésie..."
              className="w-full p-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface resize-none focus:outline-none focus:border-secondary"
            />
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-outline-variant/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">calendar_add_on</span>
              <span>{isSubmitting ? 'Enregistrement...' : 'Confirmer le Rendez-vous'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Conflict Modal with Alternative Slot */}
      {conflictingAppointment && (
        <ConflictAlertModal
          conflictingAppointment={conflictingAppointment}
          newTime={dateTime}
          onForceSave={executeSave}
          onModifyTime={() => setConflictingAppointment(null)}
          onCancel={() => {
            setConflictingAppointment(null)
            onClose()
          }}
          onAcceptSuggestedTime={(suggestedIso) => {
            setDateTime(suggestedIso)
            setConflictingAppointment(null)
            showToast('Créneau alternatif appliqué avec succès !', 'info')
          }}
        />
      )}
    </div>
  )
}
