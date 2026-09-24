import React, { useState } from 'react'
import { Devis, Patient } from '@shared/types'
import { printService } from '../../services/printService'
import { useToast } from '../../context/ToastContext'

interface PrintableDevisProps {
  devis: Devis
  patient?: Patient | null
  onClose: () => void
}

export default function PrintableDevis({
  devis,
  patient,
  onClose
}: PrintableDevisProps): JSX.Element {
  const { showToast } = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const handlePrint = async (): Promise<void> => {
    await printService.printDocument({ printBackground: true })
  }

  const handleExportPDF = async (): Promise<void> => {
    setIsExporting(true)
    try {
      const res = await printService.exportToPDF({
        title: `Devis_${devis.devisNumber || devis.id}`,
        pageSize: 'A4'
      })
      if (res.success && res.filePath) {
        showToast(`Devis enregistré en PDF : ${res.filePath}`, 'success')
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

  // Calculate validity expiration date
  const expirationDate = (() => {
    try {
      const d = new Date(devis.date || devis.createdAt)
      d.setDate(d.getDate() + (devis.validityDays || 30))
      return formatDate(d.toISOString())
    } catch {
      return '30 jours'
    }
  })()

  const items = devis.items || []

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-white text-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col my-auto print:my-0 print:border-none print:shadow-none print:max-w-none print:rounded-none">
        {/* Screen Toolbar (hidden in print) */}
        <div className="px-6 py-3.5 bg-slate-100 border-b border-slate-200 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="material-symbols-outlined text-secondary">request_quote</span>
            <span className="font-bold text-sm">
              Devis Médical & Proposition Financière Préalable (Format A4)
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

        {/* Printable Sheet */}
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
                {devis.dentistName || 'Dr. Mohamed Amrani'}
              </h2>
              <p className="text-xs text-slate-600">Chirurgien Dentiste — Omnipratique & Implantologie</p>
              <p className="text-xs text-slate-500 mt-0.5">
                12 Boulevard des Martyrs, Alger • Tél: 021 65 43 21 / 0550 12 34 56
              </p>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-secondary text-white font-mono font-bold text-xs rounded uppercase tracking-wider">
                Devis Descriptif Estimatif
              </span>
              <p className="font-mono text-lg font-black text-slate-900 mt-2">
                {devis.devisNumber}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Date : <strong className="text-slate-900">{formatDate(devis.date)}</strong>
              </p>
              <p className="text-xs text-amber-800 font-medium mt-0.5">
                Valable jusqu'au : <strong>{expirationDate}</strong> ({devis.validityDays} jours)
              </p>
            </div>
          </div>

          {/* Patient Identification Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
                Bénéficiaire des soins
              </span>
              <p className="text-base font-black text-slate-900 mt-0.5">
                {devis.patientName}
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-600 mt-0.5">
                {patient?.patientNumber && (
                  <span>Dossier N° : <strong className="font-mono text-slate-800">{patient.patientNumber}</strong></span>
                )}
                {patient?.phone && (
                  <span>Tél : <strong className="font-mono text-slate-800">{patient.phone}</strong></span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold uppercase ${
                devis.status === 'ACCEPTED'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : devis.status === 'REJECTED'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-slate-200 text-slate-800'
              }`}>
                Statut : {devis.status === 'ACCEPTED' ? 'Accepté' : devis.status === 'SENT' ? 'Présenté au patient' : devis.status}
              </span>
            </div>
          </div>

          {/* Itemized Treatments Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white font-semibold">
                  <th className="py-2.5 px-4 w-14 text-center">Dent</th>
                  <th className="py-2.5 px-4">Description des Actes & Traitements Proposés</th>
                  <th className="py-2.5 px-3">Spécialité</th>
                  <th className="py-2.5 px-3 text-center">Qté</th>
                  <th className="py-2.5 px-4 text-right">Prix Unitaire</th>
                  <th className="py-2.5 px-4 text-right">Montant (DA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500">
                      Aucun détail d'acte renseigné
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-secondary">
                        {item.toothNumber ? (
                          <span className="w-6 h-6 rounded-md bg-secondary/10 inline-flex items-center justify-center">
                            {item.toothNumber}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{item.actName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{item.specialty}</td>
                      <td className="py-2.5 px-3 text-center font-bold">{item.quantity}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                        {item.unitPriceDA.toLocaleString()} DA
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {item.totalPriceDA.toLocaleString()} DA
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end">
            <div className="w-72 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Total Brut des Actes :</span>
                <span className="font-mono font-bold">{devis.totalGrossDA.toLocaleString()} DA</span>
              </div>

              {devis.discountDA > 0 && (
                <div className="flex justify-between items-center text-rose-600 font-medium">
                  <span>Remise déduite :</span>
                  <span className="font-mono font-bold">- {devis.discountDA.toLocaleString()} DA</span>
                </div>
              )}

              <div className="flex justify-between items-center text-base font-black text-slate-900 pt-2 border-t-2 border-slate-300">
                <span>Net Total à Payer :</span>
                <span className="font-mono text-secondary">
                  {devis.totalNetDA.toLocaleString()} DA
                </span>
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 text-slate-700">
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-secondary">info</span>
              <span>Conditions d'application du devis :</span>
            </div>
            <p className="leading-relaxed">
              {devis.notes || 'Ce devis est établi sur la base de l\'examen clinique et radiologique. Toute modification clinique imprévue au cours du traitement fera l\'objet d\'une information préalable.'}
            </p>
            <p className="text-[11px] text-slate-500 pt-1">
              • Les soins seront réalisés et facturés conformément aux règles de l'art dentaire.
              • Proposition financière valable {devis.validityDays} jours.
            </p>
          </div>

          {/* Mutual Signatures Block */}
          <div className="grid grid-cols-2 gap-8 pt-4">
            {/* Dentist Stamp */}
            <div className="border border-slate-300 rounded-xl p-4 text-center min-h-[120px] flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase">
                Cachet & Signature du Praticien
              </span>
              <div className="text-[11px] text-slate-400 font-serif italic">
                Dr. Mohamed Amrani
              </div>
            </div>

            {/* Patient Agreement & Signature */}
            <div className="border border-slate-300 rounded-xl p-4 text-center min-h-[120px] flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase">
                Accord & Signature du Patient
              </span>
              <p className="text-[10px] text-slate-500 italic">
                Précédé de la mention manuscrite : « Bon pour accord »
              </p>
              <div className="text-[11px] text-slate-400">
                Date: ________________________
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="text-center text-[10px] text-slate-400 pt-2">
            Document officiel d'information financière — Devis préalable dentaire — République Algérienne Démocratique et Populaire
          </div>
        </div>
      </div>
    </div>
  )
}
