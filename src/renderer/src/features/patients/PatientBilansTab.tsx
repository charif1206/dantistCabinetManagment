import React, { useState, useEffect } from 'react'
import { Patient, LabTestOrder, LabTestOrderStatus } from '@shared/types'
import { labTestService, evaluateCriticalLabResults } from '../../services/labTestService'
import { useToast } from '../../context/ToastContext'
import NewLabTestOrderModal from '../labTests/NewLabTestOrderModal'
import PrintableLabOrder from '../labTests/PrintableLabOrder'

interface PatientBilansTabProps {
  patient: Patient
  onAlertTriggered?: () => void
}

const STATUS_CONFIG: Record<LabTestOrderStatus, { label: string; badgeClass: string; icon: string }> = {
  PENDING: { label: 'En attente résultats', badgeClass: 'bg-amber-100 text-amber-900 border-amber-200', icon: 'hourglass_top' },
  RECEIVED: { label: 'Résultats reçus', badgeClass: 'bg-sky-100 text-sky-900 border-sky-200', icon: 'download_done' },
  VALIDATED: { label: 'Bilan validé par praticien', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200', icon: 'verified' }
}

export default function PatientBilansTab({
  patient,
  onAlertTriggered
}: PatientBilansTabProps): JSX.Element {
  const { showToast } = useToast()

  const [orders, setOrders] = useState<LabTestOrder[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Modals
  const [showNewModal, setShowNewModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState<LabTestOrder | null>(null)
  const [printingOrder, setPrintingOrder] = useState<LabTestOrder | null>(null)

  // Results Entry Modal State
  const [recordingOrder, setRecordingOrder] = useState<LabTestOrder | null>(null)
  const [resultValues, setResultValues] = useState<Record<string, string>>({})
  const [isSavingResults, setIsSavingResults] = useState(false)

  const loadOrders = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const data = await labTestService.getLabOrders(patient.id)
      setOrders(data)
    } catch (err: any) {
      console.error('Error loading lab orders:', err)
      showToast('Erreur chargement des analyses', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [patient.id])

  // Open Results Entry Modal
  const handleOpenRecordResults = (order: LabTestOrder): void => {
    setRecordingOrder(order)
    let parsed: Record<string, string> = {}
    try {
      parsed = JSON.parse(order.resultsJson || '{}')
    } catch {
      parsed = {}
    }
    setResultValues(parsed)
  }

  // Save Recorded Results
  const handleSaveResults = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!recordingOrder) return

    setIsSavingResults(true)
    try {
      const evalRes = evaluateCriticalLabResults(resultValues)
      const updated = await labTestService.recordResults(
        recordingOrder.id,
        resultValues,
        evalRes.isCritical,
        evalRes.alertMessage || undefined
      )

      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      setRecordingOrder(null)

      if (evalRes.isCritical) {
        showToast(
          `⚠️ ALERTE CRITIQUE DÉTECTÉE : ${evalRes.alertMessage}`,
          'error'
        )
        if (onAlertTriggered) onAlertTriggered()
      } else {
        showToast('Résultats d’analyses enregistrés avec succès', 'success')
      }
    } catch (err: any) {
      showToast(`Erreur enregistrement résultats : ${err?.message || 'Erreur'}`, 'error')
    } finally {
      setIsSavingResults(false)
    }
  }

  // Delete Order
  const handleDelete = async (id: string, num: string): Promise<void> => {
    if (window.confirm(`Supprimer définitivement la demande d'analyses ${num} ?`)) {
      try {
        await labTestService.deleteLabOrder(id)
        setOrders((prev) => prev.filter((o) => o.id !== id))
        showToast(`Demande d'analyses ${num} supprimée`, 'info')
      } catch (err: any) {
        showToast(`Erreur suppression : ${err?.message || 'Erreur'}`, 'error')
      }
    }
  }

  const criticalOrders = orders.filter((o) => o.isCriticalAlert)
  const pendingOrders = orders.filter((o) => o.status === 'PENDING')

  return (
    <div className="space-y-6">
      {/* Critical Alert Warning Banner if any critical lab results exists */}
      {criticalOrders.length > 0 && (
        <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-2xl flex items-start gap-3.5 text-rose-950 animate-pulse shadow-xs">
          <span className="material-symbols-outlined text-rose-600 text-3xl shrink-0">
            warning
          </span>
          <div className="space-y-1">
            <h4 className="font-black text-sm uppercase tracking-wide text-rose-900">
              Alerte Sécurité Biologique Critique Détectée !
            </h4>
            <p className="text-xs text-rose-800 leading-relaxed font-semibold">
              Ce patient présente des résultats d'analyses en zone de danger vital / hémorragique :
            </p>
            <ul className="list-disc list-inside text-xs font-mono font-bold text-rose-950 space-y-0.5">
              {criticalOrders.map((o) => (
                <li key={o.id}>
                  {o.orderNumber} : {o.criticalAlertMessage || 'Anomalie biologique sévère'}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-rose-700 italic pt-1">
              Contre-indication temporaire pour toute chirurgie buccale ou pose d’implant sans avis médical spécialisé.
            </p>
          </div>
        </div>
      )}

      {/* Header & Quick stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-secondary">
            <span className="material-symbols-outlined text-xl">biotech</span>
            <span className="text-xs font-bold uppercase tracking-wider">
              Biologie Médicale & Radiographies Pré-opératoires
            </span>
          </div>
          <h3 className="text-base font-bold text-on-surface mt-1">
            Bilans Sanguins & Examens Radiologiques — {patient.lastName.toUpperCase()} {patient.firstName}
          </h3>
          <p className="text-xs text-on-surface-variant">
            Surveillance de la glycémie, hémostase (TP/INR), formule sanguine et imagerie CBCT 3D
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-xs font-mono px-3.5 py-1.5 rounded-xl bg-surface-container border border-outline-variant/40">
            <div>
              <span className="text-on-surface-variant block text-[10px]">En Attente:</span>
              <strong className="text-amber-700 font-bold">{pendingOrders.length} bilans</strong>
            </div>
            <div className="border-l border-outline-variant/40 pl-3">
              <span className="text-on-surface-variant block text-[10px]">Alertes Critiques:</span>
              <strong className={`font-bold ${criticalOrders.length > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {criticalOrders.length} alertes
              </strong>
            </div>
          </div>

          <button
            onClick={() => {
              setEditingOrder(null)
              setShowNewModal(true)
            }}
            className="px-4 py-2 bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>+ Prescrire Bilan</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl text-outline mb-2">
              science
            </span>
            <p className="font-semibold text-sm text-on-surface">
              Aucune prescription d'analyses ou bilan pré-opératoire
            </p>
            <p className="text-xs text-outline mt-1 mb-4">
              Prescrivez une ordonnance de biologie médicale ou demandez une radio panoramique / CBCT 3D
            </p>
            <button
              onClick={() => {
                setEditingOrder(null)
                setShowNewModal(true)
              }}
              className="px-4 py-2 bg-secondary text-white rounded-xl text-xs font-bold hover:bg-secondary/90 shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>Prescrire un bilan pré-opératoire</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-high/40 border-b border-outline-variant/40 text-on-surface-variant font-semibold">
                  <th className="py-3 px-4">N° Bilan</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-4">Motif / Indication</th>
                  <th className="py-3 px-4">Analyses Demandées</th>
                  <th className="py-3 px-4">Résultats Obtenus</th>
                  <th className="py-3 px-3">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {orders.map((o) => {
                  const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.PENDING
                  let testsList: string[] = []
                  let resultsMap: Record<string, string> = {}
                  try {
                    testsList = JSON.parse(o.testsRequestedJson || '[]')
                  } catch {
                    testsList = []
                  }
                  try {
                    resultsMap = JSON.parse(o.resultsJson || '{}')
                  } catch {
                    resultsMap = {}
                  }

                  const hasResults = Object.keys(resultsMap).length > 0

                  return (
                    <tr
                      key={o.id}
                      className={`hover:bg-surface-container-low/60 transition-colors ${
                        o.isCriticalAlert ? 'bg-rose-50/50' : ''
                      }`}
                    >
                      {/* Order Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-secondary">
                        <button
                          onClick={() => setPrintingOrder(o)}
                          className="hover:underline flex items-center gap-1 cursor-pointer"
                          title="Imprimer l'ordonnance d'analyses"
                        >
                          <span className="material-symbols-outlined text-sm">receipt_long</span>
                          <span>{o.orderNumber}</span>
                        </button>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-3 font-mono text-on-surface">
                        {o.requestDate ? o.requestDate.slice(0, 10) : '—'}
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-on-surface block max-w-[180px] truncate" title={o.reason || ''}>
                          {o.reason || 'Bilan de contrôle'}
                        </span>
                        <span className="text-[10px] text-on-surface-variant font-medium">
                          {o.dentistName}
                        </span>
                      </td>

                      {/* Requested Tests */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {testsList.slice(0, 3).map((t, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container text-on-surface font-semibold"
                            >
                              {t}
                            </span>
                          ))}
                          {testsList.length > 3 && (
                            <span className="text-[10px] text-outline font-semibold">
                              +{testsList.length - 3} autres
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Results & Critical Evaluation */}
                      <td className="py-3.5 px-4">
                        {o.isCriticalAlert ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[11px] font-bold animate-pulse">
                              <span className="material-symbols-outlined text-xs">dangerous</span>
                              Valeur Critique !
                            </span>
                            <p className="text-[10px] text-rose-800 font-mono font-bold truncate max-w-[220px]" title={o.criticalAlertMessage || ''}>
                              {o.criticalAlertMessage}
                            </p>
                          </div>
                        ) : hasResults ? (
                          <div className="space-y-0.5">
                            {Object.entries(resultsMap).slice(0, 2).map(([k, v]) => (
                              <div key={k} className="text-[11px] font-mono">
                                <span className="text-on-surface-variant">{k} : </span>
                                <strong className="text-slate-800">{v}</strong>
                              </div>
                            ))}
                            {Object.keys(resultsMap).length > 2 && (
                              <span className="text-[10px] text-secondary font-semibold">
                                {Object.keys(resultsMap).length} valeurs saisies
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-outline italic">
                            Non renseigné
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.badgeClass}`}>
                          <span className="material-symbols-outlined text-xs">{cfg.icon}</span>
                          <span>{cfg.label}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Saisir Résultats button */}
                          <button
                            onClick={() => handleOpenRecordResults(o)}
                            className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-secondary hover:text-white text-on-surface text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                            title="Saisir ou consulter les valeurs retournées par le laboratoire"
                          >
                            <span className="material-symbols-outlined text-sm">edit_note</span>
                            <span>Résultats</span>
                          </button>

                          {/* Print Ordonnance */}
                          <button
                            onClick={() => setPrintingOrder(o)}
                            className="p-1.5 rounded-lg text-secondary hover:bg-secondary-fixed/50 transition-colors cursor-pointer"
                            title="Imprimer l'ordonnance d'analyses"
                          >
                            <span className="material-symbols-outlined text-base">print</span>
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(o.id, o.orderNumber)}
                            className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/30 transition-colors cursor-pointer"
                            title="Supprimer"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
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

      {/* Record Results Modal */}
      {recordingOrder && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest text-on-surface w-full max-w-xl rounded-2xl shadow-2xl border border-outline-variant/60 overflow-hidden flex flex-col my-auto animate-in fade-in duration-150">
            <div className="px-6 py-4 bg-surface-container-high border-b border-outline-variant/60 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-2xl">science</span>
                <div>
                  <h3 className="font-bold text-base">
                    Saisie des Résultats d'Analyses — {recordingOrder.orderNumber}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Contrôle automatique des seuils de sécurité (Glycémie &gt; 1.80, INR &gt; 3.0, Plaquettes &lt; 100.000)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRecordingOrder(null)}
                className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveResults} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="space-y-3">
                {(() => {
                  let testNames: string[] = []
                  try {
                    testNames = JSON.parse(recordingOrder.testsRequestedJson || '[]')
                  } catch {
                    testNames = []
                  }

                  return testNames.map((testName) => {
                    const val = resultValues[testName] || ''
                    // Check if individual value is critical
                    const singleEval = evaluateCriticalLabResults({ [testName]: val })
                    const isCritical = singleEval.isCritical

                    return (
                      <div
                        key={testName}
                        className={`p-3 rounded-xl border transition-all ${
                          isCritical
                            ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-400/40'
                            : 'bg-surface border-outline-variant/60'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <label className="font-bold text-xs text-on-surface">{testName}</label>
                          {isCritical && (
                            <span className="text-[10px] font-bold text-rose-700 font-mono flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-xs">error</span>
                              Valeur critique !
                            </span>
                          )}
                        </div>

                        <input
                          type="text"
                          placeholder="Ex: 1.05 g/L, 1.15 INR, 220.000 /mm³, Négatif..."
                          value={val}
                          onChange={(e) =>
                            setResultValues((prev) => ({
                              ...prev,
                              [testName]: e.target.value
                            }))
                          }
                          className={`w-full px-3 py-1.5 rounded-lg border text-xs font-mono font-bold ${
                            isCritical
                              ? 'border-rose-500 bg-white text-rose-700'
                              : 'border-outline-variant bg-surface-container-low text-on-surface'
                          }`}
                        />
                      </div>
                    )
                  })
                })()}
              </div>

              {/* Real-time Evaluation Summary */}
              {(() => {
                const evalRes = evaluateCriticalLabResults(resultValues)
                if (evalRes.isCritical) {
                  return (
                    <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-xs text-rose-900 font-semibold space-y-1">
                      <div className="flex items-center gap-1 font-bold">
                        <span className="material-symbols-outlined text-sm text-rose-700">warning</span>
                        <span>Alerte de Sécurité Clinique :</span>
                      </div>
                      <p className="text-[11px] font-mono leading-relaxed">{evalRes.alertMessage}</p>
                    </div>
                  )
                }
                return null
              })()}

              <div className="pt-3 border-t border-outline-variant/60 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRecordingOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingResults}
                  className="px-5 py-2 bg-primary-container text-on-primary hover:bg-on-secondary-fixed-variant rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSavingResults ? 'Enregistrement...' : 'Valider & Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Modal */}
      {showNewModal && (
        <NewLabTestOrderModal
          isOpen={showNewModal}
          onClose={() => {
            setShowNewModal(false)
            setEditingOrder(null)
          }}
          onSuccess={(savedOrder, shouldPrint) => {
            loadOrders()
            if (shouldPrint) {
              setPrintingOrder(savedOrder)
            }
          }}
          initialPatient={patient}
          existingOrder={editingOrder}
        />
      )}

      {/* Printable Modal */}
      {printingOrder && (
        <PrintableLabOrder
          order={printingOrder}
          patient={patient}
          onClose={() => setPrintingOrder(null)}
        />
      )}
    </div>
  )
}
