import React, { useState, useEffect } from 'react'
import { Patient, ProthesisOrder, ProthesisOrderStatus, ProstheticLaboratory } from '@shared/types'
import { prothesisService } from '../../services/prothesisService'
import { useToast } from '../../context/ToastContext'
import NewProthesisOrderModal from '../prothesis/NewProthesisOrderModal'
import PrintableLabSlip from '../prothesis/PrintableLabSlip'

interface PatientProthesisTabProps {
  patient: Patient
}

const STATUS_BADGES: Record<ProthesisOrderStatus, { label: string; badgeClass: string; icon: string }> = {
  PREPARATION: { label: '1. Préparation / Empreinte', badgeClass: 'bg-amber-100 text-amber-900 border-amber-200', icon: 'edit_note' },
  SENT: { label: '2. Au Labo (Fabrication)', badgeClass: 'bg-sky-100 text-sky-900 border-sky-200', icon: 'local_shipping' },
  RECEIVED: { label: '3. Reçu au Cabinet', badgeClass: 'bg-purple-100 text-purple-900 border-purple-200', icon: 'inventory_2' },
  FITTING: { label: '4. Essayage en Bouche', badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-200', icon: 'dentistry' },
  DELIVERED: { label: '5. Posé Définitif', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200', icon: 'check_circle' },
  REJECTED: { label: 'Refait / Rejeté', badgeClass: 'bg-rose-100 text-rose-900 border-rose-200', icon: 'cancel' }
}

export default function PatientProthesisTab({ patient }: PatientProthesisTabProps): JSX.Element {
  const { showToast } = useToast()
  const [orders, setOrders] = useState<ProthesisOrder[]>([])
  const [labs, setLabs] = useState<ProstheticLaboratory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState<ProthesisOrder | null>(null)
  const [printingOrder, setPrintingOrder] = useState<ProthesisOrder | null>(null)

  const loadPatientOrders = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const [orderList, labList] = await Promise.all([
        prothesisService.getOrders({ patientId: patient.id }),
        prothesisService.getLabs()
      ])
      setOrders(orderList)
      setLabs(labList)
    } catch (err: any) {
      console.error('Error fetching patient prothesis orders:', err)
      showToast('Erreur chargement prothèses patient', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPatientOrders()
  }, [patient.id])

  const handleStatusChange = async (orderId: string, newStatus: ProthesisOrderStatus): Promise<void> => {
    try {
      await prothesisService.updateOrderStatus(orderId, newStatus)
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)))
      showToast('Statut mis à jour', 'success')
    } catch (err: any) {
      showToast(`Erreur : ${err?.message || 'Erreur'}`, 'error')
    }
  }

  const handleDelete = async (orderId: string, orderNumber: string): Promise<void> => {
    if (window.confirm(`Supprimer la commande ${orderNumber} ?`)) {
      try {
        await prothesisService.deleteOrder(orderId)
        setOrders((prev) => prev.filter((o) => o.id !== orderId))
        showToast('Commande supprimée', 'info')
      } catch (err: any) {
        showToast(`Erreur suppression : ${err?.message || 'Erreur'}`, 'error')
      }
    }
  }

  const totalCost = orders.reduce((sum, o) => sum + (o.labCostDA || 0), 0)
  const totalPrice = orders.reduce((sum, o) => sum + (o.clinicPriceDA || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header and Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-secondary">
            <span className="material-symbols-outlined text-xl">precision_manufacturing</span>
            <span className="text-xs font-bold uppercase tracking-wider">
              Travaux Prothétiques du Patient
            </span>
          </div>
          <h2 className="text-base font-bold text-on-surface mt-1">
            Commandes & Suivi Mylab — {patient.lastName.toUpperCase()} {patient.firstName}
          </h2>
          <p className="text-xs text-on-surface-variant">
            {orders.length} commande(s) de prothèse enregistrée(s)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 text-xs font-mono px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant/40">
            <div>
              <span className="text-on-surface-variant block text-[10px]">Total Coût Labo:</span>
              <strong className="text-slate-800 font-bold">{totalCost.toLocaleString()} DA</strong>
            </div>
            <div className="border-l border-outline-variant/40 pl-3">
              <span className="text-on-surface-variant block text-[10px]">Facturation Patient:</span>
              <strong className="text-secondary font-bold">{totalPrice.toLocaleString()} DA</strong>
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
            <span>+ Commander Prothèse</span>
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl text-outline mb-2">
              biotech
            </span>
            <p className="font-semibold text-sm text-on-surface">
              Aucune commande de prothèse pour ce patient
            </p>
            <p className="text-xs text-outline mt-1 mb-4">
              Enregistrez une empreinte pour envoyer un bon de commande au laboratoire externe
            </p>
            <button
              onClick={() => {
                setEditingOrder(null)
                setShowNewModal(true)
              }}
              className="px-4 py-2 bg-secondary text-white rounded-xl text-xs font-bold hover:bg-secondary/90 shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>Créer une commande prothèse</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-high/40 border-b border-outline-variant/40 text-on-surface-variant font-semibold">
                  <th className="py-3 px-4">N° Bon</th>
                  <th className="py-3 px-4">Dent / Acte</th>
                  <th className="py-3 px-3 text-center">Teinte</th>
                  <th className="py-3 px-4">Laboratoire</th>
                  <th className="py-3 px-3">Date Prévue</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-3 text-right">Coût Labo</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {orders.map((o) => {
                  const badge = STATUS_BADGES[o.status] || STATUS_BADGES.PREPARATION
                  return (
                    <tr key={o.id} className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-secondary">
                        <button
                          onClick={() => setPrintingOrder(o)}
                          className="hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">receipt</span>
                          <span>{o.orderNumber}</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {o.toothNumber ? (
                            <span className="w-6 h-6 rounded-md bg-secondary/10 text-secondary font-mono font-bold flex items-center justify-center shrink-0 border border-secondary/20">
                              {o.toothNumber}
                            </span>
                          ) : (
                            <span className="w-6 h-6 rounded-md bg-surface-container text-on-surface-variant font-mono text-[10px] flex items-center justify-center shrink-0">
                              Arc.
                            </span>
                          )}
                          <div>
                            <span className="font-semibold text-on-surface block">{o.actName}</span>
                            <span className="text-[10px] text-outline">{o.nature}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-950 font-mono font-bold border border-amber-300">
                          {o.shade}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-on-surface">{o.labName}</td>
                      <td className="py-3.5 px-3 font-mono text-on-surface">
                        {o.expectedDate ? o.expectedDate.slice(0, 10) : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={o.status}
                          onChange={(e) =>
                            handleStatusChange(o.id, e.target.value as ProthesisOrderStatus)
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${badge.badgeClass}`}
                        >
                          <option value="PREPARATION">1. Préparation</option>
                          <option value="SENT">2. Envoyé au labo</option>
                          <option value="RECEIVED">3. Reçu au cabinet</option>
                          <option value="FITTING">4. Essayage bouche</option>
                          <option value="DELIVERED">5. Posé / Livré</option>
                          <option value="REJECTED">Refait / Rejeté</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-on-surface">
                        {o.labCostDA ? o.labCostDA.toLocaleString() : '0'} DA
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPrintingOrder(o)}
                            className="p-1.5 rounded-lg text-secondary hover:bg-secondary-fixed/50 transition-colors cursor-pointer"
                            title="Imprimer Fiche Navette / Bon Labo"
                          >
                            <span className="material-symbols-outlined text-base">print</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingOrder(o)
                              setShowNewModal(true)
                            }}
                            className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                            title="Modifier"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
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

      {/* New / Edit Modal */}
      {showNewModal && (
        <NewProthesisOrderModal
          isOpen={showNewModal}
          onClose={() => {
            setShowNewModal(false)
            setEditingOrder(null)
          }}
          onSuccess={() => loadPatientOrders()}
          initialPatient={patient}
          existingOrder={editingOrder}
        />
      )}

      {/* Printable Slip */}
      {printingOrder && (
        <PrintableLabSlip
          order={printingOrder}
          patient={patient}
          lab={labs.find((l) => l.id === printingOrder.labId)}
          onClose={() => setPrintingOrder(null)}
        />
      )}
    </div>
  )
}
