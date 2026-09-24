import React, { useState, useEffect } from 'react'
import { Patient, Devis, DevisStatus } from '@shared/types'
import { devisService } from '../../services/devisService'
import { useToast } from '../../context/ToastContext'
import CreateDevisModal from '../devis/CreateDevisModal'
import PrintableDevis from '../devis/PrintableDevis'
import TreatmentProjectsRoadmap from '../devis/TreatmentProjectsRoadmap'

interface PatientDevisTabProps {
  patient: Patient
  onTreatmentsCreated?: () => void
}

const STATUS_BADGES: Record<DevisStatus, { label: string; badgeClass: string }> = {
  DRAFT: { label: 'Brouillon', badgeClass: 'bg-slate-100 text-slate-800 border-slate-200' },
  SENT: { label: 'Remis au Patient', badgeClass: 'bg-sky-100 text-sky-800 border-sky-200' },
  ACCEPTED: { label: 'Accepté', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  REJECTED: { label: 'Refusé', badgeClass: 'bg-rose-100 text-rose-800 border-rose-200' }
}

export default function PatientDevisTab({
  patient,
  onTreatmentsCreated
}: PatientDevisTabProps): JSX.Element {
  const { showToast } = useToast()

  const [activeSection, setActiveSection] = useState<'devis' | 'projects'>('devis')
  const [devisList, setDevisList] = useState<Devis[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingDevis, setEditingDevis] = useState<Devis | null>(null)
  const [printingDevis, setPrintingDevis] = useState<Devis | null>(null)
  const [isConvertingId, setIsConvertingId] = useState<string | null>(null)

  const loadPatientDevis = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const data = await devisService.getDevis(patient.id)
      setDevisList(data)
    } catch (err: any) {
      console.error('Error fetching patient devis:', err)
      showToast('Erreur chargement devis', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPatientDevis()
  }, [patient.id])

  // Quick Status change
  const handleStatusChange = async (devisId: string, status: DevisStatus): Promise<void> => {
    try {
      await devisService.updateDevisStatus(devisId, status)
      setDevisList((prev) =>
        prev.map((d) => (d.id === devisId ? { ...d, status } : d))
      )
      showToast('Statut du devis mis à jour', 'success')
    } catch (err: any) {
      showToast(`Erreur : ${err?.message || 'Erreur'}`, 'error')
    }
  }

  // 1-Click Convert Devis to Treatments
  const handleConvertToTreatments = async (devis: Devis): Promise<void> => {
    if (
      !window.confirm(
        `Convertir le devis ${devis.devisNumber} (${devis.items?.length || 0} actes) en soins planifiés au dossier du patient ?`
      )
    ) {
      return
    }

    setIsConvertingId(devis.id)
    try {
      const res = await devisService.convertDevisToTreatments(devis.id)
      if (res.success) {
        showToast(
          `Succès : ${res.createdTreatmentsCount} actes ont été créés dans le plan de soins du patient !`,
          'success'
        )
        // Refresh local devis list (status changed to ACCEPTED)
        await loadPatientDevis()
        if (onTreatmentsCreated) onTreatmentsCreated()
      } else {
        showToast('Aucun acte n’a pu être converti', 'error')
      }
    } catch (err: any) {
      showToast(`Erreur conversion : ${err?.message || 'Erreur'}`, 'error')
    } finally {
      setIsConvertingId(null)
    }
  }

  // Delete Devis
  const handleDeleteDevis = async (id: string, num: string): Promise<void> => {
    if (window.confirm(`Supprimer définitivement le devis ${num} ?`)) {
      try {
        await devisService.deleteDevis(id)
        setDevisList((prev) => prev.filter((d) => d.id !== id))
        showToast(`Devis ${num} supprimé`, 'info')
      } catch (err: any) {
        showToast(`Erreur suppression : ${err?.message || 'Erreur'}`, 'error')
      }
    }
  }

  const totalDevisAmount = devisList.reduce((acc, d) => acc + (d.totalNetDA || 0), 0)
  const acceptedDevisCount = devisList.filter((d) => d.status === 'ACCEPTED').length

  return (
    <div className="space-y-6">
      {/* Sub-navigation pill toggle: Devis vs Roadmap projects */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="inline-flex p-1 rounded-xl bg-surface-container border border-outline-variant/60 shadow-2xs">
          <button
            onClick={() => setActiveSection('devis')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSection === 'devis'
                ? 'bg-surface text-secondary shadow-xs font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">request_quote</span>
            <span>Devis & Propositions ({devisList.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('projects')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSection === 'projects'
                ? 'bg-surface text-secondary shadow-xs font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">conversion_path</span>
            <span>Plans Séquencés (ODF / Implant)</span>
          </button>
        </div>

        {activeSection === 'devis' && (
          <button
            onClick={() => {
              setEditingDevis(null)
              setShowCreateModal(true)
            }}
            className="px-4 py-2 bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>+ Nouveau Devis</span>
          </button>
        )}
      </div>

      {activeSection === 'projects' ? (
        <TreatmentProjectsRoadmap patient={patient} />
      ) : (
        <>
          {/* Summary Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-secondary">
                <span className="material-symbols-outlined text-xl">description</span>
                <span className="text-xs font-bold uppercase tracking-wider">
                  Devis Médicaux Préalables (DA)
                </span>
              </div>
              <h3 className="text-base font-bold text-on-surface mt-1">
                Estimations Financières — {patient.lastName.toUpperCase()} {patient.firstName}
              </h3>
              <p className="text-xs text-on-surface-variant">
                Devis officiels séparés de la comptabilité avec conversion directe en actes de soins
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-4 text-xs font-mono px-3.5 py-1.5 rounded-xl bg-surface-container border border-outline-variant/40">
                <div>
                  <span className="text-on-surface-variant block text-[10px]">Devis Acceptés:</span>
                  <strong className="text-emerald-700 font-bold">
                    {acceptedDevisCount} / {devisList.length}
                  </strong>
                </div>
                <div className="border-l border-outline-variant/40 pl-3">
                  <span className="text-on-surface-variant block text-[10px]">Total Estimé Net:</span>
                  <strong className="text-secondary font-bold">
                    {totalDevisAmount.toLocaleString()} DA
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Devis Table */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs overflow-hidden">
            {devisList.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl text-outline mb-2">
                  post_add
                </span>
                <p className="font-semibold text-sm text-on-surface">
                  Aucun devis établi pour ce patient
                </p>
                <p className="text-xs text-outline mt-1 mb-4">
                  Créez une proposition financière formelle pour les traitements prothétiques ou chirurgicaux
                </p>
                <button
                  onClick={() => {
                    setEditingDevis(null)
                    setShowCreateModal(true)
                  }}
                  className="px-4 py-2 bg-secondary text-white rounded-xl text-xs font-bold hover:bg-secondary/90 shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>Créer un devis estimatif</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-container-high/40 border-b border-outline-variant/40 text-on-surface-variant font-semibold">
                      <th className="py-3 px-4">N° Devis</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-4">Contenu des Actes</th>
                      <th className="py-3 px-3 text-right">Total Brut</th>
                      <th className="py-3 px-3 text-right">Remise</th>
                      <th className="py-3 px-4 text-right">Net à Payer</th>
                      <th className="py-3 px-3">Statut</th>
                      <th className="py-3 px-4 text-right">Actions & Conversion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {devisList.map((d) => {
                      const badge = STATUS_BADGES[d.status] || STATUS_BADGES.DRAFT
                      const itemsCount = d.items?.length || 0

                      return (
                        <tr key={d.id} className="hover:bg-surface-container-low/60 transition-colors">
                          {/* Devis Number */}
                          <td className="py-3.5 px-4 font-mono font-bold text-secondary">
                            <button
                              onClick={() => setPrintingDevis(d)}
                              className="hover:underline flex items-center gap-1 cursor-pointer"
                              title="Aperçu & impression du devis"
                            >
                              <span className="material-symbols-outlined text-sm">receipt_long</span>
                              <span>{d.devisNumber}</span>
                            </button>
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-3 font-mono text-on-surface">
                            {d.date ? d.date.slice(0, 10) : '—'}
                          </td>

                          {/* Items summary */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-on-surface">
                                {itemsCount} acte(s)
                              </span>
                              {d.items && d.items[0] && (
                                <span className="text-[11px] text-outline truncate max-w-[200px]">
                                  ({d.items[0].actName} {itemsCount > 1 ? `+${itemsCount - 1}` : ''})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Gross DA */}
                          <td className="py-3.5 px-3 text-right font-mono text-on-surface-variant">
                            {d.totalGrossDA.toLocaleString()} DA
                          </td>

                          {/* Discount */}
                          <td className="py-3.5 px-3 text-right font-mono text-error font-medium">
                            {d.discountDA > 0 ? `-${d.discountDA.toLocaleString()} DA` : '—'}
                          </td>

                          {/* Net DA */}
                          <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-secondary">
                            {d.totalNetDA.toLocaleString()} DA
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3">
                            <select
                              value={d.status}
                              onChange={(e) =>
                                handleStatusChange(d.id, e.target.value as DevisStatus)
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${badge.badgeClass}`}
                            >
                              <option value="DRAFT">Brouillon</option>
                              <option value="SENT">Présenté</option>
                              <option value="ACCEPTED">Accepté</option>
                              <option value="REJECTED">Refusé</option>
                            </select>
                          </td>

                          {/* Actions & 1-Click Conversion */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 1-Click Convert to Treatments button */}
                              <button
                                onClick={() => handleConvertToTreatments(d)}
                                disabled={isConvertingId === d.id}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs ${
                                  d.status === 'ACCEPTED'
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-surface-container hover:bg-secondary hover:text-white text-on-surface'
                                }`}
                                title="Transformer tous les actes du devis en soins planifiés au schéma clinique"
                              >
                                <span className="material-symbols-outlined text-sm">
                                  {isConvertingId === d.id ? 'sync' : 'auto_mode'}
                                </span>
                                <span>{isConvertingId === d.id ? '...' : 'En Soins'}</span>
                              </button>

                              {/* Print */}
                              <button
                                onClick={() => setPrintingDevis(d)}
                                className="p-1.5 rounded-lg text-secondary hover:bg-secondary-fixed/50 transition-colors cursor-pointer"
                                title="Imprimer le devis officiel"
                              >
                                <span className="material-symbols-outlined text-base">print</span>
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => {
                                  setEditingDevis(d)
                                  setShowCreateModal(true)
                                }}
                                className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                                title="Modifier"
                              >
                                <span className="material-symbols-outlined text-base">edit</span>
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteDevis(d.id, d.devisNumber)}
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
        </>
      )}

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <CreateDevisModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false)
            setEditingDevis(null)
          }}
          onSuccess={() => loadPatientDevis()}
          initialPatient={patient}
          existingDevis={editingDevis}
        />
      )}

      {/* Printable Modal */}
      {printingDevis && (
        <PrintableDevis
          devis={printingDevis}
          patient={patient}
          onClose={() => setPrintingDevis(null)}
        />
      )}
    </div>
  )
}
