import React, { useState } from 'react'
import { Invoice, Patient } from '@shared/types'
import { printService } from '../../services/printService'
import { useToast } from '../../context/ToastContext'

interface InvoiceItemParsed {
  description: string
  quantity?: number
  unitPrice?: number
  amount: number
}

interface PrintableInvoiceProps {
  invoice: Invoice
  patient?: Patient | null
  onClose: () => void
}

export default function PrintableInvoice({
  invoice,
  patient,
  onClose
}: PrintableInvoiceProps): JSX.Element {
  const { showToast } = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const handlePrint = async (): Promise<void> => {
    await printService.printDocument({ printBackground: true })
  }

  const handleExportPDF = async (): Promise<void> => {
    setIsExporting(true)
    try {
      const res = await printService.exportToPDF({
        title: `Facture_${invoice.invoiceNumber || invoice.id}`,
        pageSize: 'A4'
      })
      if (res.success && res.filePath) {
        showToast(`Facture enregistrée en PDF : ${res.filePath}`, 'success')
      }
    } catch (err: any) {
      showToast(`Erreur export PDF : ${err?.message || 'Erreur'}`, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  // Parse itemsJson safely
  let items: InvoiceItemParsed[] = []
  try {
    items = JSON.parse(invoice.itemsJson || '[]')
  } catch (err) {
    items = [{ description: 'Soins et actes dentaires', amount: invoice.totalAmount }]
  }

  const paymentMethodLabel = (method?: string): string => {
    switch (method) {
      case 'CASH':
        return 'Espèces (Caisse)'
      case 'CHECK':
        return 'Chèque bancaire'
      case 'TRANSFER':
        return 'Virement bancaire / CCP'
      default:
        return 'Espèces'
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-white text-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col my-auto print:my-0 print:border-none print:shadow-none print:max-w-none print:rounded-none">
        {/* Screen Toolbar (hidden in print) */}
        <div className="px-6 py-3.5 bg-slate-100 border-b border-slate-200 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="material-symbols-outlined text-secondary">receipt_long</span>
            <span className="font-bold text-sm">
              Aperçu avant Impression — Facture & Note d'Honoraires (Format A4)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="px-3 py-2 bg-surface hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Enregistrer la facture en PDF"
            >
              <span className="material-symbols-outlined text-base text-rose-600">picture_as_pdf</span>
              <span>{isExporting ? 'Export...' : 'Exporter PDF'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-secondary hover:bg-secondary/90 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>Imprimer</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet (Standard Algerian A5 / A4 Format) */}
        <div className="p-8 sm:p-12 space-y-6 bg-white min-h-[640px] flex flex-col justify-between" id="printable-invoice">
          {/* Header */}
          <div className="border-b-2 border-slate-800 pb-5 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                Dr. Mohamed Amrani
              </h1>
              <p className="text-xs font-bold text-secondary uppercase tracking-wider mt-0.5">
                Chirurgien-Dentiste
              </p>
              <p className="text-[11px] text-slate-600 mt-1">
                Soins, Chirurgie Orale, Implantologie & Prothèses
              </p>
              <p className="text-[11px] text-slate-600">
                14 Rue Didouche Mourad, Alger · Tél : <span className="font-semibold">0550 12 34 56</span>
              </p>
            </div>

            <div className="text-right">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl ml-auto mb-1">
                <span className="material-symbols-outlined text-2xl">dentistry</span>
              </div>
              <span className="text-[11px] font-bold text-slate-800 block">DentaFlow Clinic DZ</span>
              <span className="text-[10px] text-slate-500">Alger, Algérie</span>
            </div>
          </div>

          {/* Invoice Meta Banner */}
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">
                Note d'Honoraires / Facture
              </span>
              <span className="text-base font-black font-mono text-slate-900">
                {invoice.invoiceNumber}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">
                Date de délivrance
              </span>
              <span className="font-bold text-slate-800">
                {invoice.date}
              </span>
            </div>
          </div>

          {/* Patient Details */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500 text-[11px] block">Patient(e) :</span>
              <span className="font-bold text-sm text-slate-900">{invoice.patientName}</span>
              {patient?.patientNumber && (
                <span className="text-[11px] font-mono text-slate-600 block">
                  Dossier : {patient.patientNumber}
                </span>
              )}
            </div>
            <div className="text-right">
              {patient?.phone && (
                <div className="text-[11px] text-slate-600">
                  Tél : <span className="font-mono font-semibold">{patient.phone}</span>
                </div>
              )}
              {patient?.cin && (
                <div className="text-[11px] text-slate-600">
                  N° CIN : <span className="font-mono font-semibold">{patient.cin}</span>
                </div>
              )}
              {patient?.wilaya && (
                <div className="text-[11px] text-slate-500">
                  Wilaya : {patient.wilaya}
                </div>
              )}
            </div>
          </div>

          {/* Actes / Treatments Table */}
          <div className="flex-1 space-y-2">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 text-slate-600 uppercase text-[10px] font-bold">
                  <th className="py-2 px-2 w-8">#</th>
                  <th className="py-2 px-2">Désignation de l'acte / Traitement</th>
                  <th className="py-2 px-2 text-center w-16">Qté</th>
                  <th className="py-2 px-2 text-right w-24">Prix (DA)</th>
                  <th className="py-2 px-2 text-right w-28">Total (DA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => {
                  const qty = item.quantity || 1
                  const unitPrice = item.unitPrice || Math.round(item.amount / qty)
                  return (
                    <tr key={idx} className="text-slate-800">
                      <td className="py-2.5 px-2 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-2 font-medium">{item.description}</td>
                      <td className="py-2.5 px-2 text-center font-mono">{qty}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                        {unitPrice.toLocaleString()} DA
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                        {item.amount.toLocaleString()} DA
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Financial Totals Bento Box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>Montant Total des Soins :</span>
              <span className="font-mono font-bold text-slate-800">
                {invoice.totalAmount.toLocaleString()} DA
              </span>
            </div>

            <div className="flex justify-between items-center text-emerald-800 border-t border-slate-200/80 pt-1.5">
              <span>Montant Encaissé (Acompte / Règlements) :</span>
              <span className="font-mono font-bold text-emerald-700">
                - {invoice.paidAmount.toLocaleString()} DA
              </span>
            </div>

            <div className="flex justify-between items-center text-sm font-black border-t-2 border-slate-800 pt-2 text-slate-900">
              <span>Reste à Payer (Solde Dû) :</span>
              <span className={`font-mono ${invoice.remainingAmount > 0 ? 'text-amber-800 font-black text-base' : 'text-slate-600'}`}>
                {invoice.remainingAmount.toLocaleString()} DA
              </span>
            </div>

            <div className="text-[11px] text-slate-500 pt-1 flex justify-between items-center">
              <span>Mode de règlement : <strong>{paymentMethodLabel(invoice.paymentMethod)}</strong></span>
              <span className="font-semibold uppercase tracking-wider">
                Statut : {invoice.remainingAmount === 0 ? 'Facture Acquittée' : 'Partiellement Réglée'}
              </span>
            </div>
          </div>

          {/* Legal mention & Signature Box */}
          <div className="pt-6 border-t border-slate-200 flex justify-between items-end">
            <div className="text-[10px] text-slate-400 font-mono max-w-xs">
              Document officiel délivré par le cabinet dentaire.<br />
              Logiciel certifié DentaFlow Algeria 2026.
            </div>

            <div className="text-center w-48">
              <span className="text-xs font-semibold text-slate-600 block mb-12">
                Cachet & Signature
              </span>
              <div className="border-t border-dashed border-slate-400 pt-1 text-[11px] font-bold text-slate-800">
                Dr. Mohamed Amrani
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
