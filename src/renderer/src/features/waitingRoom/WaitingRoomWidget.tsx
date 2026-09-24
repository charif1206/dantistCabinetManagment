import React, { useState, useEffect } from 'react'
import { WaitingRoomEntry, Patient } from '@shared/types'
import { waitingRoomService } from '../../services/waitingRoomService'
import { patientService } from '../../services/patientService'
import { appointmentService } from '../../services/appointmentService'
import { useToast } from '../../context/ToastContext'
import { useNavigation } from '../../context/NavigationContext'

interface WaitingRoomWidgetProps {
  onQueueUpdated?: () => void
}

function getMinutesWaiting(arrivalTime: string): number {
  try {
    const arrival = new Date(arrivalTime).getTime()
    const now = Date.now()
    const diffMinutes = Math.floor((now - arrival) / (1000 * 60))
    return Math.max(0, diffMinutes)
  } catch {
    return 0
  }
}

export default function WaitingRoomWidget({ onQueueUpdated }: WaitingRoomWidgetProps): JSX.Element {
  const { showToast } = useToast()
  const { openPatient } = useNavigation()

  const [queue, setQueue] = useState<WaitingRoomEntry[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [, setTick] = useState(0) // Tick to force re-render elapsed minutes every 30s

  // Quick Walk-in Admission Modal
  const [showWalkInModal, setShowWalkInModal] = useState(false)
  const [walkInPatientSearch, setWalkInPatientSearch] = useState('')
  const [selectedWalkInPatientId, setSelectedWalkInPatientId] = useState('')
  const [isUrgentWalkIn, setIsUrgentWalkIn] = useState(false)
  const [walkInPriorityNote, setWalkInPriorityNote] = useState('')
  const [isSubmittingWalkIn, setIsSubmittingWalkIn] = useState(false)

  const loadQueue = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const [queueData, patientList] = await Promise.all([
        waitingRoomService.getWaitingQueue(),
        patientService.getPatients()
      ])
      // Filter only active entries in waiting room (WAITING or IN_CHAIR)
      const activeEntries = queueData.filter(
        (entry) => entry.status === 'WAITING' || entry.status === 'IN_CHAIR'
      )
      setQueue(activeEntries)
      setPatients(patientList)
    } catch (err: any) {
      console.error('Error fetching waiting room queue:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadQueue()

    // Refresh elapsed minutes every 30 seconds
    const interval = setInterval(() => {
      setTick((t) => t + 1)
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  // Call patient to dental chair
  const handleCallToChair = async (entry: WaitingRoomEntry): Promise<void> => {
    try {
      await waitingRoomService.callPatientToChair(entry.id)
      // If linked to an appointment, also update appointment status to IN_CHAIR
      if (entry.appointmentId) {
        await appointmentService.updateStatus(entry.appointmentId, 'IN_CHAIR')
      }

      showToast(`Patient ${entry.patientName} appelé au fauteuil`, 'success')
      await loadQueue()
      if (onQueueUpdated) onQueueUpdated()

      // Open patient file immediately for practitioner
      const p = patients.find((pat) => pat.id === entry.patientId)
      if (p) {
        openPatient(p, 'overview')
      }
    } catch (err: any) {
      showToast(`Erreur appel au fauteuil : ${err?.message || 'Erreur'}`, 'error')
    }
  }

  // Finish patient visit
  const handleFinishVisit = async (entry: WaitingRoomEntry): Promise<void> => {
    try {
      await waitingRoomService.finishVisit(entry.id)
      if (entry.appointmentId) {
        await appointmentService.updateStatus(entry.appointmentId, 'COMPLETED')
      }
      showToast(`Visite de ${entry.patientName} terminée`, 'info')
      await loadQueue()
      if (onQueueUpdated) onQueueUpdated()
    } catch (err: any) {
      showToast(`Erreur : ${err?.message || 'Erreur'}`, 'error')
    }
  }

  // Remove from queue (Absent / Quitté)
  const handleRemove = async (entry: WaitingRoomEntry): Promise<void> => {
    try {
      await waitingRoomService.updateStatus(entry.id, 'LEFT', undefined, new Date().toISOString())
      showToast(`${entry.patientName} retiré de la salle d'attente`, 'info')
      await loadQueue()
      if (onQueueUpdated) onQueueUpdated()
    } catch (err: any) {
      showToast(`Erreur : ${err?.message || 'Erreur'}`, 'error')
    }
  }

  // Add quick walk-in patient to queue
  const handleAddWalkIn = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!selectedWalkInPatientId) {
      showToast('Veuillez sélectionner un patient', 'error')
      return
    }

    const patient = patients.find((p) => p.id === selectedWalkInPatientId)
    if (!patient) return

    setIsSubmittingWalkIn(true)
    try {
      await waitingRoomService.addToWaitingQueue({
        patientId: patient.id,
        patientName: `${patient.lastName.toUpperCase()} ${patient.firstName}`,
        patientPhone: patient.phone,
        status: 'WAITING',
        isUrgent: isUrgentWalkIn ? 1 : 0,
        priorityNote: walkInPriorityNote.trim() || (isUrgentWalkIn ? 'Urgence dentaire (Sans RDV)' : 'Consultation sans RDV (Walk-in)')
      })

      showToast(`Patient ${patient.lastName} ${patient.firstName} admis en salle d'attente`, 'success')
      setShowWalkInModal(false)
      setSelectedWalkInPatientId('')
      setWalkInPatientSearch('')
      setIsUrgentWalkIn(false)
      setWalkInPriorityNote('')
      await loadQueue()
      if (onQueueUpdated) onQueueUpdated()
    } catch (err: any) {
      showToast(`Erreur admission : ${err?.message || 'Erreur'}`, 'error')
    } finally {
      setIsSubmittingWalkIn(false)
    }
  }

  const filteredPatients = patients.filter((p) =>
    `${p.lastName} ${p.firstName} ${p.patientNumber}`
      .toLowerCase()
      .includes(walkInPatientSearch.toLowerCase())
  )

  const waitingCount = queue.filter((e) => e.status === 'WAITING').length
  const inChairCount = queue.filter((e) => e.status === 'IN_CHAIR').length
  const urgentCount = queue.filter((e) => e.isUrgent && e.status === 'WAITING').length

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-secondary-fixed/50 text-secondary flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">airline_seat_recline_normal</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-on-surface">
                Salle d'Attente en Direct
              </h3>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Flux temps réel des patients présents au cabinet dentaire
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Stats Pills */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-bold">
              {waitingCount} en attente
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-900 border border-purple-200 font-bold">
              {inChairCount} au fauteuil
            </span>
            {urgentCount > 0 && (
              <span className="px-2 py-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 font-black animate-pulse flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">emergency</span>
                {urgentCount} urgence(s)
              </span>
            )}
          </div>

          <button
            onClick={() => setShowWalkInModal(true)}
            className="px-3 py-1.5 bg-primary-container text-on-primary hover:bg-on-secondary-fixed-variant rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
            title="Admettre immédiatement un patient présent sans RDV"
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            <span>+ Entrée Directe</span>
          </button>
        </div>
      </div>

      {/* Queue Table */}
      <div className="border border-outline-variant/40 rounded-xl overflow-hidden">
        {queue.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant bg-surface-container-low/30">
            <span className="material-symbols-outlined text-3xl text-outline mb-1">
              chair
            </span>
            <p className="font-semibold text-xs text-on-surface">Salle d'attente vide</p>
            <p className="text-[11px] text-outline mt-0.5">
              Aucun patient n'est actuellement en attente ou au fauteuil.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-high/40 border-b border-outline-variant/40 text-on-surface-variant font-semibold">
                  <th className="py-2.5 px-4 w-12 text-center">Rang</th>
                  <th className="py-2.5 px-4">Patient & Priorité</th>
                  <th className="py-2.5 px-3">Arrivée</th>
                  <th className="py-2.5 px-4">Temps d'Attente</th>
                  <th className="py-2.5 px-3">Statut Actuel</th>
                  <th className="py-2.5 px-4 text-right">Actions Fauteuil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {queue.map((entry, index) => {
                  const minutesWaiting = getMinutesWaiting(entry.arrivalTime)
                  const isLongWait = minutesWaiting > 30 && entry.status === 'WAITING'
                  const isUrgent = Boolean(entry.isUrgent)
                  const isInChair = entry.status === 'IN_CHAIR'

                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-surface-container-low/60 transition-colors ${
                        isUrgent
                          ? 'bg-rose-50/40'
                          : isInChair
                          ? 'bg-purple-50/40'
                          : ''
                      }`}
                    >
                      {/* Queue Rank Number */}
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        <span
                          className={`w-6 h-6 rounded-md inline-flex items-center justify-center text-xs ${
                            isUrgent
                              ? 'bg-rose-600 text-white font-black'
                              : isInChair
                              ? 'bg-purple-600 text-white font-black'
                              : 'bg-surface-container-high text-on-surface'
                          }`}
                        >
                          {index + 1}
                        </span>
                      </td>

                      {/* Patient Name & Urgency Badge */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <span className="font-bold text-on-surface block text-xs">
                              {entry.patientName}
                            </span>
                            {entry.patientPhone && (
                              <span className="text-[10px] text-outline font-mono">
                                {entry.patientPhone}
                              </span>
                            )}
                          </div>

                          {isUrgent && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-2xs animate-pulse">
                              <span className="material-symbols-outlined text-xs">emergency</span>
                              <span>URGENCE</span>
                            </span>
                          )}

                          {entry.priorityNote && !isUrgent && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant truncate max-w-[140px]">
                              {entry.priorityNote}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Arrival Time */}
                      <td className="py-3 px-3 font-mono font-medium text-slate-700">
                        {new Date(entry.arrivalTime).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      {/* Dynamic Elapsed Waiting Timer */}
                      <td className="py-3 px-4">
                        {isInChair ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-purple-800 font-semibold">
                            <span className="material-symbols-outlined text-sm">dentistry</span>
                            <span>Au fauteuil</span>
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                                isLongWait
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300 font-black'
                                  : minutesWaiting > 15
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-surface-container text-on-surface'
                              }`}
                            >
                              {minutesWaiting} min
                            </span>
                            <span className="text-[10px] text-on-surface-variant font-medium">
                              {isLongWait ? '⚠️ Attente longue' : 'écoulées'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isInChair
                              ? 'bg-purple-100 text-purple-900 border border-purple-200'
                              : 'bg-amber-100 text-amber-900 border border-amber-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-xs">
                            {isInChair ? 'chair_alt' : 'schedule'}
                          </span>
                          <span>{isInChair ? 'Au Fauteuil' : 'En Attente'}</span>
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isInChair ? (
                            <button
                              onClick={() => handleFinishVisit(entry)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                              title="Marquer la visite comme terminée"
                            >
                              <span className="material-symbols-outlined text-sm">check</span>
                              <span>Terminer</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleCallToChair(entry)}
                              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                              title="Faire entrer le patient au fauteuil et ouvrir son dossier"
                            >
                              <span className="material-symbols-outlined text-sm">airline_seat_recline_extra</span>
                              <span>Au Fauteuil</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleRemove(entry)}
                            className="p-1 rounded-lg text-outline hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Patient absent ou a quitté la salle"
                          >
                            <span className="material-symbols-outlined text-base">person_cancel</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Walk-in Admission Modal */}
      {showWalkInModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest text-on-surface w-full max-w-lg rounded-2xl shadow-2xl border border-outline-variant/60 overflow-hidden flex flex-col my-auto animate-in fade-in duration-150">
            <div className="px-5 py-3.5 bg-surface-container-high border-b border-outline-variant/60 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-xl">person_add</span>
                <h4 className="font-bold text-sm">Entrée Immédiate en Salle d'Attente</h4>
              </div>
              <button
                onClick={() => setShowWalkInModal(false)}
                className="p-1 rounded-lg text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleAddWalkIn} className="p-5 space-y-4 text-xs">
              {/* Patient Selection */}
              <div className="space-y-1">
                <label className="font-bold text-on-surface block">
                  Sélectionner le Patient Présent *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Chercher par nom, prénom ou N° dossier..."
                    value={walkInPatientSearch}
                    onChange={(e) => {
                      setWalkInPatientSearch(e.target.value)
                      setSelectedWalkInPatientId('')
                    }}
                    className="w-full px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
                  />
                  {walkInPatientSearch && !selectedWalkInPatientId && filteredPatients.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 max-h-36 overflow-y-auto bg-surface-container-high border border-outline-variant rounded-xl shadow-lg divide-y divide-outline-variant/30">
                      {filteredPatients.slice(0, 5).map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedWalkInPatientId(p.id)
                            setWalkInPatientSearch(`${p.lastName} ${p.firstName}`)
                          }}
                          className="px-3 py-1.5 hover:bg-surface-container cursor-pointer flex justify-between items-center"
                        >
                          <span className="font-semibold">{p.lastName} {p.firstName}</span>
                          <span className="font-mono text-[10px] text-secondary">{p.patientNumber}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Urgency Toggle */}
              <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/60 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-600 text-lg">emergency</span>
                    <div>
                      <span className="font-bold text-xs text-on-surface block">
                        Cas d'Urgence / RDV Rapide
                      </span>
                      <span className="text-[10px] text-on-surface-variant">
                        Passe en tête de file d'attente avec alerte visuelle rouge
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isUrgentWalkIn}
                    onChange={(e) => setIsUrgentWalkIn(e.target.checked)}
                    className="h-4 w-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                </label>
              </div>

              {/* Note / Reason */}
              <div className="space-y-1">
                <label className="font-bold text-on-surface block">
                  Motif / Note pour le praticien
                </label>
                <input
                  type="text"
                  placeholder="Ex: Douleur dentaire aiguë 46, abcès, bague ODF décollée..."
                  value={walkInPriorityNote}
                  onChange={(e) => setWalkInPriorityNote(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs"
                />
              </div>

              <div className="pt-2 border-t border-outline-variant/60 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWalkIn}
                  className="px-4 py-1.5 bg-primary-container text-on-primary hover:bg-on-secondary-fixed-variant rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  {isSubmittingWalkIn ? 'Admission...' : 'Admettre en Salle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
