import React from 'react'
import { Appointment } from '@shared/types'

interface ConflictAlertModalProps {
  conflictingAppointment: Appointment
  newTime: string
  onForceSave: () => void
  onModifyTime: () => void
  onCancel: () => void
  onAcceptSuggestedTime?: (suggestedIso: string) => void
}

export default function ConflictAlertModal({
  conflictingAppointment,
  newTime,
  onForceSave,
  onModifyTime,
  onCancel,
  onAcceptSuggestedTime
}: ConflictAlertModalProps): JSX.Element {
  const existingTimeStr = new Date(conflictingAppointment.dateTime).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  })

  // Calculate suggested alternative slot (immediately after the conflicting appointment ends or next morning if > 22:00)
  const conflictingStart = new Date(conflictingAppointment.dateTime).getTime()
  const conflictingDuration = conflictingAppointment.durationMinutes || 30
  const suggestedSlot = new Date(conflictingStart + conflictingDuration * 60 * 1000)

  // If the suggested time exceeds 22:00, roll over to next morning at 08:00
  const isPastEveningShift = suggestedSlot.getHours() > 22 || (suggestedSlot.getHours() === 22 && suggestedSlot.getMinutes() > 0)
  if (isPastEveningShift) {
    suggestedSlot.setDate(suggestedSlot.getDate() + 1)
    suggestedSlot.setHours(8, 0, 0, 0)
  }

  const pad = (n: number): string => String(n).padStart(2, '0')
  const suggestedIso = `${suggestedSlot.getFullYear()}-${pad(suggestedSlot.getMonth() + 1)}-${pad(
    suggestedSlot.getDate()
  )}T${pad(suggestedSlot.getHours())}:${pad(suggestedSlot.getMinutes())}`

  const isNextDay = suggestedSlot.getDate() !== new Date(conflictingAppointment.dateTime).getDate()
  const suggestedTimeDisplay = isNextDay
    ? `Demain à ${suggestedSlot.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : suggestedSlot.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-amber-300 w-full max-w-lg p-6 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-2xl">warning</span>
          </div>
          <div>
            <h3 className="font-bold text-base text-on-surface">
              Conflit d'horaire détecté
            </h3>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              Le praticien <strong>{conflictingAppointment.dentistName || 'Dr. Mohamed Amrani'}</strong> est déjà occupé sur ce créneau horaire.
            </p>
          </div>
        </div>

        {/* Conflicting Appointment Details Card */}
        <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 space-y-2">
          <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
            Rendez-vous existant en chevauchement :
          </span>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-700 text-base">person</span>
              <span>{conflictingAppointment.patientName}</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 font-mono font-bold text-[11px]">
              {existingTimeStr} ({conflictingAppointment.durationMinutes || 30} min)
            </span>
          </div>
          <div className="text-[11px] text-slate-700 pl-5">
            Soin : <strong className="text-slate-900">{conflictingAppointment.treatmentType}</strong> · Praticien : {conflictingAppointment.dentistName || 'Dr. Amrani'}
          </div>
        </div>

        {/* Suggested Alternative Slot */}
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">auto_fix_high</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider block">
                Créneau alternatif disponible :
              </span>
              <span className="text-xs text-emerald-800 font-semibold">
                Dès la fin de la séance à <strong>{suggestedTimeDisplay}</strong>
              </span>
            </div>
          </div>

          {onAcceptSuggestedTime && (
            <button
              type="button"
              aria-label={`Choisir le créneau alternatif : ${suggestedTimeDisplay}`}
              onClick={() => onAcceptSuggestedTime(suggestedIso)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
            >
              Choisir {suggestedTimeDisplay}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-outline-variant/40">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onForceSave}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-outline-variant hover:bg-surface-container text-xs font-semibold text-on-surface transition-colors cursor-pointer"
          >
            Forcer le créneau
          </button>
          <button
            type="button"
            onClick={onModifyTime}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            Changer l'heure
          </button>
        </div>
      </div>
    </div>
  )
}
