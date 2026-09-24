import React, { useState } from 'react'
import { Patient, Appointment } from '@shared/types'
import { appointmentService } from '../../services/appointmentService'
import { clinicalService } from '../../services/clinicalService'
import { useToast } from '../../context/ToastContext'

interface NewVisitModalProps {
  patient: Patient
  onClose: () => void
  onSuccess: () => void
}

export default function NewVisitModal({
  patient,
  onClose,
  onSuccess
}: NewVisitModalProps): JSX.Element {
  const { showToast } = useToast()
  const [actType, setActType] = useState('Consultation de contrôle')
  const [practitioner, setPractitioner] = useState('Dr. Mohamed Amrani')
  const [dateTime, setDateTime] = useState(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  })
  const [notes, setNotes] = useState('Examen clinique complet, contrôle parodontal et détartrage sous-gingival')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (status: Appointment['status'] = 'IN_CHAIR'): Promise<void> => {
    setIsSubmitting(true)
    try {
      // 1. Save appointment in SQLite
      await appointmentService.saveAppointment({
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientPhone: patient.phone,
        dateTime: new Date(dateTime).toISOString(),
        durationMinutes: 30,
        treatmentType: actType,
        status,
        dentistName: practitioner,
        notes
      })

      // 2. If notes provided, also record an initial clinical note
      if (notes.trim()) {
        await clinicalService.saveClinicalNote({
          patientId: patient.id,
          practitioner,
          date: dateTime.split('T')[0],
          title: `Visite: ${actType}`,
          category: actType.includes('Urgence') ? 'EMERGENCY' : 'CONSULTATION',
          content: notes
        })
      }

      showToast(
        status === 'IN_CHAIR'
          ? `Patient ${patient.firstName} ${patient.lastName} installé au fauteuil !`
          : `Visite clinique enregistrée avec succès !`,
        'success'
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Failed to save clinical visit:', err)
      showToast(`Erreur lors de l'enregistrement de la visite: ${err?.message || 'Erreur interne'}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex justify-end">
      <div className="w-full sm:w-[440px] bg-surface-container-lowest h-full flex flex-col shadow-2xl border-l border-outline-variant animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-outline-variant/60 flex items-center justify-between bg-surface-container-low shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-secondary text-2xl">clinical_notes</span>
            <div>
              <h2 className="font-bold text-base text-on-surface">Nouvelle Visite Clinique</h2>
              <span className="text-xs text-on-surface-variant font-medium">Fauteuil & Consultation</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Patient Ribbon */}
        <div className="bg-surface-container px-6 py-3 border-b border-outline-variant/40 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-secondary-fixed text-secondary flex items-center justify-center font-bold text-sm">
            {patient.firstName[0]}
            {patient.lastName[0]}
          </div>
          <div>
            <div className="text-xs font-bold text-on-surface">
              {patient.firstName} {patient.lastName}
            </div>
            <div className="text-[11px] font-mono text-outline">{patient.patientNumber}</div>
          </div>
          {patient.medicalAlerts && (
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-error-container text-error truncate max-w-[130px]">
              {patient.medicalAlerts}
            </span>
          )}
        </div>

        {/* Drawer Body Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Motif de consultation / Type d'acte <span className="text-error">*</span>
            </label>
            <select
              value={actType}
              onChange={(e) => setActType(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs font-medium text-on-surface cursor-pointer"
            >
              <option value="Consultation de contrôle">Consultation de contrôle</option>
              <option value="Urgence dentaire (Douleur / Pulpite)">Urgence dentaire (Douleur / Pulpite)</option>
              <option value="Détartrage & Polissage">Détartrage & Polissage</option>
              <option value="Soin conservateur (Carie / Composite)">Soin conservateur (Carie / Composite)</option>
              <option value="Traitement Endodontique (Dévitalisation)">Traitement Endodontique (Dévitalisation)</option>
              <option value="Extraction dentaire">Extraction dentaire</option>
              <option value="Prothèse (Fixe / Amovible)">Prothèse (Fixe / Amovible)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                Praticien
              </label>
              <input
                type="text"
                value={practitioner}
                onChange={(e) => setPractitioner(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                Date & Heure
              </label>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="w-full h-10 px-2 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Notes cliniques initiales (Symptômes & Motif)
            </label>
            <textarea
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Douleur vive au chaud/froid depuis 48h, gencive tuméfiée..."
              className="w-full p-3 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs text-on-surface resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-outline-variant/40 bg-surface-container-low shrink-0 space-y-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit('IN_CHAIR')}
            className="w-full h-11 bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">airline_seat_recline_extra</span>
            <span>Installer au Fauteuil Maintenant</span>
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit('COMPLETED')}
            className="w-full h-10 bg-surface border border-outline-variant hover:bg-surface-container text-on-surface rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">check_circle</span>
            <span>Enregistrer comme Visite Terminée</span>
          </button>
        </div>
      </div>
    </div>
  )
}
