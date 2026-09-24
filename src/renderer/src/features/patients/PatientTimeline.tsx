import React, { useState, useEffect } from 'react'
import { Patient, Appointment, Treatment, Invoice, Payment, ClinicalNote } from '@shared/types'
import { appointmentService } from '../../services/appointmentService'
import { clinicalService } from '../../services/clinicalService'
import { billingService } from '../../services/billingService'

interface PatientTimelineProps {
  patient: Patient
  onOpenNewVisit: () => void
  onOpenDentalChart: () => void
  onOpenPrescriptions: () => void
}

interface TimelineItem {
  id: string
  date: string
  time?: string
  type: 'VISIT' | 'TREATMENT' | 'PAYMENT' | 'NOTE'
  title: string
  subtitle: string
  amountDA?: number
  badge?: string
  status?: string
}

export default function PatientTimeline({
  patient,
  onOpenNewVisit,
  onOpenDentalChart,
  onOpenPrescriptions
}: PatientTimelineProps): JSX.Element {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [notes, setNotes] = useState<ClinicalNote[]>([])
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadData = async (): Promise<void> => {
    try {
      const [apts, trts, invs, nts] = await Promise.all([
        appointmentService.getAppointments(),
        clinicalService.getTreatments(patient.id),
        billingService.getInvoices(patient.id),
        clinicalService.getClinicalNotes(patient.id)
      ])

      const patientApts = apts.filter((a) => a.patientId === patient.id)
      setAppointments(patientApts)
      setTreatments(trts)
      setInvoices(invs)
      setNotes(nts)

      // Merge into unified chronological timeline
      const items: TimelineItem[] = []

      // Add Appointments / Visits
      patientApts.forEach((a) => {
        items.push({
          id: `apt_${a.id}`,
          date: a.dateTime.split('T')[0],
          time: a.dateTime.split('T')[1]?.slice(0, 5),
          type: 'VISIT',
          title: `Visite: ${a.treatmentType}`,
          subtitle: `Praticien: ${a.dentistName || 'Dr. Amrani'} · ${a.notes || 'Aucune note spécifique'}`,
          status: a.status
        })
      })

      // Add Treatments
      trts.forEach((t) => {
        items.push({
          id: `trt_${t.id}`,
          date: t.date,
          type: 'TREATMENT',
          title: `Soin: ${t.actName} ${t.toothNumber ? `(Dent ${t.toothNumber})` : ''}`,
          subtitle: t.notes || 'Acte enregistré au dossier',
          amountDA: t.price,
          status: t.status
        })
      })

      // Add Clinical Notes
      nts.forEach((n) => {
        items.push({
          id: `note_${n.id}`,
          date: n.date,
          type: 'NOTE',
          title: `Observation: ${n.title}`,
          subtitle: n.content.length > 120 ? `${n.content.substring(0, 120)}...` : n.content,
          badge: n.category
        })
      })

      // Sort by date descending
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setTimelineItems(items)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [patient.id])

  // Find upcoming appointment
  const nextAppointment = appointments
    .filter((a) => new Date(a.dateTime).getTime() >= Date.now() && a.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())[0]

  const totalBilledDA = treatments.reduce((sum, t) => sum + (t.price || 0), 0)
  const totalPaidDA = invoices.reduce((sum, i) => sum + (i.paidAmount || 0), 0)
  const remainingDebtDA = Math.max(0, totalBilledDA - totalPaidDA)

  if (isLoading) {
    return (
      <div className="py-16 flex items-center justify-center gap-2 text-secondary">
        <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
        <span className="text-xs font-medium">Chargement de l'historique du dossier...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Bento Cards: Next appointment & Clinical Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Next Appointment Card */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-2xl">calendar_clock</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-outline uppercase tracking-wider block">
                Prochain Rendez-vous
              </span>
              {nextAppointment ? (
                <>
                  <p className="text-xs font-bold text-on-surface">
                    {new Date(nextAppointment.dateTime).toLocaleDateString('fr-FR', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short'
                    })}{' '}
                    à {nextAppointment.dateTime.split('T')[1]?.slice(0, 5)}
                  </p>
                  <span className="text-[11px] text-on-surface-variant">
                    {nextAppointment.treatmentType}
                  </span>
                </>
              ) : (
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                  Aucun rendez-vous planifié
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onOpenNewVisit}
            className="px-3 py-1.5 rounded-lg border border-outline-variant/60 hover:bg-surface-container text-xs font-semibold text-on-surface transition-colors cursor-pointer"
          >
            + Fixer
          </button>
        </div>

        {/* Financial Balance in Algerian Dinars */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-xs ${
                remainingDebtDA > 0
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-tertiary-fixed text-on-tertiary-container'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">payments</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-outline uppercase tracking-wider block">
                Solde & Reste à Payer
              </span>
              <p
                className={`text-base font-bold font-mono ${
                  remainingDebtDA > 0 ? 'text-pending-orange' : 'text-on-tertiary-container'
                }`}
              >
                {remainingDebtDA.toLocaleString()} DA
              </p>
              <span className="text-[11px] text-on-surface-variant">
                Total soins : {totalBilledDA.toLocaleString()} DA
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions Shortcuts */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 shadow-xs flex flex-col justify-center gap-2">
          <button
            onClick={onOpenDentalChart}
            className="w-full py-2 px-3 rounded-xl bg-secondary-fixed/50 hover:bg-secondary-fixed text-secondary font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">dentistry</span>
            <span>Ouvrir Schéma Dentaire</span>
          </button>
          <button
            onClick={onOpenPrescriptions}
            className="w-full py-2 px-3 rounded-xl border border-outline-variant/60 hover:bg-surface-container text-on-surface font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">prescriptions</span>
            <span>+ Rédiger Ordonnance</span>
          </button>
        </div>
      </div>

      {/* Unified Timeline Feed */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-xs">
        <h3 className="font-bold text-sm text-on-surface mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">history</span>
          <span>Chronologie Clinique & Historique des Soins</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-semibold">
            {timelineItems.length}
          </span>
        </h3>

        {timelineItems.length === 0 ? (
          <div className="text-center py-12 text-on-surface-variant text-xs space-y-2">
            <span className="material-symbols-outlined text-3xl text-outline">timeline</span>
            <p>Le dossier de ce patient est encore vierge.</p>
            <button
              onClick={onOpenNewVisit}
              className="text-secondary font-semibold hover:underline"
            >
              Enregistrer une première visite
            </button>
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant/40">
            {timelineItems.map((item) => (
              <div key={item.id} className="relative group">
                {/* Timeline Dot */}
                <div
                  className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 border-surface-container-lowest flex items-center justify-center shadow-xs ${
                    item.type === 'VISIT'
                      ? 'bg-secondary text-white'
                      : item.type === 'TREATMENT'
                      ? 'bg-primary-container text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[11px]">
                    {item.type === 'VISIT'
                      ? 'event'
                      : item.type === 'TREATMENT'
                      ? 'dentistry'
                      : 'description'}
                  </span>
                </div>

                {/* Event Card */}
                <div className="bg-surface p-4 rounded-xl border border-outline-variant/40 group-hover:border-secondary/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-on-surface">{item.title}</span>
                      {item.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant">
                          {item.badge}
                        </span>
                      )}
                      {item.status && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                            item.status === 'COMPLETED'
                              ? 'bg-tertiary-fixed text-on-tertiary-container'
                              : item.status === 'IN_CHAIR'
                              ? 'bg-purple-100 text-purple-900 animate-pulse'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {item.status === 'IN_CHAIR'
                            ? 'Au fauteuil'
                            : item.status === 'COMPLETED'
                            ? 'Terminé'
                            : item.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant">{item.subtitle}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold text-outline">
                      {item.date} {item.time ? `· ${item.time}` : ''}
                    </div>
                    {item.amountDA !== undefined && (
                      <span className="font-mono font-bold text-xs text-secondary block mt-0.5">
                        {item.amountDA.toLocaleString()} DA
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
