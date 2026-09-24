import React, { useState } from 'react'
import { ProthesisOrder, Patient, ProstheticLaboratory } from '@shared/types'
import { printService } from '../../services/printService'
import { useToast } from '../../context/ToastContext'

interface PrintableLabSlipProps {
  order: ProthesisOrder
  patient?: Patient | null
  lab?: ProstheticLaboratory | null
  onClose: () => void
}

export default function PrintableLabSlip({
  order,
  patient,
  lab,
  onClose
}: PrintableLabSlipProps): JSX.Element {
  const { showToast } = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const handlePrint = async (): Promise<void> => {
    await printService.printDocument({ printBackground: true })
  }

  const handleExportPDF = async (): Promise<void> => {
    setIsExporting(true)
    try {
      const res = await printService.exportToPDF({
        title: `Bon_Labo_${order.orderNumber || order.id}`,
        pageSize: 'A4'
      })
      if (res.success && res.filePath) {
        showToast(`Bon de travail enregistré en PDF : ${res.filePath}`, 'success')
      }
    } catch (err: any) {
      showToast(`Erreur export PDF : ${err?.message || 'Erreur'}`, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-white text-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col my-auto print:my-0 print:border-none print:shadow-none print:max-w-none print:rounded-none">
        {/* Screen Toolbar (hidden in print) */}
        <div className="px-6 py-3.5 bg-slate-100 border-b border-slate-200 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="material-symbols-outlined text-secondary">precision_manufacturing</span>
            <span className="font-bold text-sm">
              Fiche Navette & Bon de Travail de Laboratoire (Format A4 / A5)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-secondary text-white rounded-lg text-xs font-semibold hover:bg-secondary/90 shadow-xs cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              <span>Imprimer</span>
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
              <span>{isExporting ? 'Export...' : 'Exporter PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 cursor-pointer transition-colors"
              title="Fermer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 sm:p-10 space-y-6 text-sm print:p-6 print:space-y-4 font-sans">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-secondary pb-5">
            <div>
              <div className="flex items-center gap-2 text-secondary">
                <span className="material-symbols-outlined text-3xl">dentistry</span>
                <span className="text-xl font-black tracking-tight uppercase">
                  Cabinet Dentaire
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-800 mt-1">
                {order.dentistName || 'Dr. Mohamed Amrani'}
              </h2>
              <p className="text-xs text-slate-600">Chirurgien Dentiste — Prothèse & Omnipratique</p>
              <p className="text-xs text-slate-500 mt-0.5">
                12 Boulevard des Martyrs, Alger • Tél: 021 65 43 21 / 0550 12 34 56
              </p>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-secondary text-white font-mono font-bold text-xs rounded uppercase tracking-wider">
                Bon de Commande Labo
              </span>
              <p className="font-mono text-lg font-black text-slate-900 mt-2">
                {order.orderNumber}
              </p>
              <p className="text-xs text-slate-500">
                Date d'envoi: <strong className="text-slate-800">{formatDate(order.sentDate || order.createdAt)}</strong>
              </p>
              {order.expectedDate && (
                <p className="text-xs text-slate-600 mt-0.5">
                  Livraison souhaitée: <strong className="text-amber-800 font-bold">{formatDate(order.expectedDate)}</strong>
                </p>
              )}
            </div>
          </div>

          {/* Recipient Lab & Patient Summary Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Laboratory Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-secondary font-bold text-xs uppercase tracking-wide">
                <span className="material-symbols-outlined text-sm">home_work</span>
                <span>Laboratoire Destinataire</span>
              </div>
              <p className="font-black text-slate-900 text-base">{order.labName}</p>
              {lab?.phone && (
                <p className="text-xs text-slate-600 font-mono">Tél: {lab.phone}</p>
              )}
              {lab?.wilaya && (
                <p className="text-xs text-slate-500">Wilaya: {lab.wilaya}</p>
              )}
              {lab?.contactPerson && (
                <p className="text-xs text-slate-500">À l'attention de: {lab.contactPerson}</p>
              )}
            </div>

            {/* Patient Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-secondary font-bold text-xs uppercase tracking-wide">
                <span className="material-symbols-outlined text-sm">person</span>
                <span>Identification Patient</span>
              </div>
              <p className="font-black text-slate-900 text-base">{order.patientName}</p>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                {patient?.patientNumber && (
                  <span>Dossier: <strong className="font-mono text-slate-800">{patient.patientNumber}</strong></span>
                )}
                {patient?.gender && (
                  <span>Sexe: {patient.gender === 'F' ? 'Femme' : 'Homme'}</span>
                )}
              </div>
              {patient?.dateOfBirth && (
                <p className="text-xs text-slate-500">
                  Né(e) le: {new Date(patient.dateOfBirth).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          </div>

          {/* Prosthesis Clinical Specifications Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
              <span>Spécifications de la Prothèse Commandée</span>
              <span>Code Travail: {order.nature}</span>
            </div>

            <div className="p-4 bg-white grid grid-cols-3 gap-4 border-b border-slate-200">
              {/* Tooth Number */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 font-semibold uppercase block">Dent (Schéma FDI)</span>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/10 text-secondary font-black font-mono text-lg border border-secondary/20">
                    {order.toothNumber ? order.toothNumber : '—'}
                  </span>
                  <span className="text-xs text-slate-600 font-medium">
                    {order.toothNumber ? `Dent ${order.toothNumber}` : 'Arcade / Multiples'}
                  </span>
                </div>
              </div>

              {/* Shade / Teinte (Key Clinical Spec) */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 font-semibold uppercase block">Teinte & Couleur</span>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 font-black font-mono text-base border-2 border-amber-300 shadow-xs">
                    {order.shade}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    (Guide Vita / 3D Master)
                  </span>
                </div>
              </div>

              {/* Nature / Type */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 font-semibold uppercase block">Nature de l'Élément</span>
                <p className="font-bold text-slate-800 text-sm">{order.actName}</p>
                <span className="text-xs text-slate-500">{order.nature}</span>
              </div>
            </div>

            {/* Workflow Elements Checked */}
            <div className="p-4 bg-slate-50 text-xs text-slate-700 grid grid-cols-4 gap-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-sm">check_box</span>
                <span>Empreinte jointe</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-sm">check_box</span>
                <span>Antagoniste joint</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-sm">check_box</span>
                <span>Morsure en cire</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-sm">check_box</span>
                <span>Guide de teinte vérifié</span>
              </div>
            </div>
          </div>

          {/* Clinical Instructions / Notes */}
          <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs uppercase tracking-wide">
              <span className="material-symbols-outlined text-sm">assignment</span>
              <span>Instructions Spéciales au Prothésiste</span>
            </div>
            <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed min-h-[50px]">
              {order.notes || 'Respecter le dégagement occlusal et le profil d\'émergence cervical. Finition polie lustrée.'}
            </p>
          </div>

          {/* Pricing & Terms (Discreet / Professional) */}
          <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-200">
            <div>
              <span>Statut de la commande: </span>
              <strong className="text-slate-800 font-semibold">{order.status}</strong>
            </div>
            {order.labCostDA > 0 && (
              <div>
                <span>Coût laboratoire convenu: </span>
                <strong className="text-slate-900 font-mono font-bold">
                  {order.labCostDA.toLocaleString()} DA
                </strong>
              </div>
            )}
          </div>

          {/* Signatures & Stamps */}
          <div className="grid grid-cols-2 gap-8 pt-6">
            <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center min-h-[110px] flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase">
                Cachet & Signature du Praticien
              </span>
              <div className="text-[11px] text-slate-400 font-serif italic">
                Dr. Mohamed Amrani
              </div>
            </div>

            <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center min-h-[110px] flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase">
                Accusé de Réception du Laboratoire
              </span>
              <div className="text-[11px] text-slate-400">
                Date & Visa du technicien: ____________
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="text-center text-[10px] text-slate-400 pt-3">
            Fiche navette officielle — Cabinet Dentaire Dr. Amrani — Système Mylab Algérie
          </div>
        </div>
      </div>
    </div>
  )
}
