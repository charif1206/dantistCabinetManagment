import React from 'react'
import { Payment, Patient, Invoice } from '@shared/types'
import { useToast } from '../../context/ToastContext'

interface PrintableReceiptModalProps {
  payment: Payment
  patient: Patient
  invoice?: Invoice | null
  onClose: () => void
}

/**
  * Converts an integer number into French words for Algerian Dinars (DA)
  * e.g., 8000 -> "Huit Mille Dinars Algériens"
  */
export function numberToFrenchWords(n: number): string {
  if (n <= 0) return 'Zéro Dinar Algérien'

  const units = ['', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf']
  const teens = [
    'Dix',
    'Onze',
    'Douze',
    'Treize',
    'Quatorze',
    'Quinze',
    'Seize',
    'Dix-Sept',
    'Dix-Huit',
    'Dix-Neuf'
  ]
  const tens = [
    '',
    'Dix',
    'Vingt',
    'Trente',
    'Quarante',
    'Cinquante',
    'Soixante',
    'Soixante-Dix',
    'Quatre-Vingt',
    'Quatre-Vingt-Dix'
  ]

  function convertBelow1000(num: number): string {
    let str = ''
    const c = Math.floor(num / 100)
    const r = num % 100

    if (c > 0) {
      if (c === 1) {
        str += 'Cent '
      } else {
        str += units[c] + ' Cent '
      }
    }

    if (r > 0) {
      if (r < 10) {
        str += units[r]
      } else if (r >= 10 && r < 20) {
        str += teens[r - 10]
      } else {
        const t = Math.floor(r / 10)
        const u = r % 10
        if (t === 7) {
          str += 'Soixante-' + teens[u]
        } else if (t === 9) {
          str += 'Quatre-Vingt-' + teens[u]
        } else {
          str += tens[t] + (u > 0 ? (u === 1 ? ' et Un' : '-' + units[u]) : t === 8 ? 's' : '')
        }
      }
    }
    return str.trim()
  }

  const millions = Math.floor(n / 1000000)
  const thousands = Math.floor((n % 1000000) / 1000)
  const remainder = n % 1000

  const parts: string[] = []

  if (millions > 0) {
    if (millions === 1) {
      parts.push('Un Million')
    } else {
      parts.push(convertBelow1000(millions) + ' Millions')
    }
  }

  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('Mille')
    } else {
      parts.push(convertBelow1000(thousands) + ' Mille')
    }
  }

  if (remainder > 0) {
    parts.push(convertBelow1000(remainder))
  }

  const words = parts.join(' ')
  return `${words} Dinars Algériens`
}

export default function PrintableReceiptModal({
  payment,
  patient,
  invoice,
  onClose
}: PrintableReceiptModalProps): JSX.Element {
  const { showToast } = useToast()

  const receiptNumber = payment.receiptNumber || `REC-2026-0001`
  const paymentMethodLabel =
    payment.method === 'CASH'
      ? 'Espèces'
      : payment.method === 'CHECK'
        ? 'Chèque Bancaire'
        : 'Virement / BaridiMob'

  const amountInWords = numberToFrenchWords(Math.round(payment.amount))

  const handlePrint = async (): Promise<void> => {
    try {
      if (window.api?.printDocument) {
        await window.api.printDocument({ printBackground: true })
      } else {
        window.print()
      }
    } catch (err) {
      console.error('Print failed:', err)
      showToast("Erreur lors de l'impression du reçu", 'error')
    }
  }

  const handleExportPDF = async (): Promise<void> => {
    try {
      if (window.api?.exportToPDF) {
        const defaultName = `Recu_${receiptNumber}_${patient.lastName}`.replace(/[\s/\\:]/g, '_')
        const res = await window.api.exportToPDF({
          pageSize: 'A5',
          title: defaultName
        })
        if (res.success) {
          showToast(`Reçu enregistré en PDF avec succès : ${res.filePath || ''}`, 'success')
        }
      } else {
        window.print()
      }
    } catch (err) {
      console.error('PDF export failed:', err)
      showToast("Erreur lors de l'exportation du reçu en PDF", 'error')
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4 overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-white text-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col my-auto print:my-0 print:border-none print:shadow-none print:max-w-none print:rounded-none">
        {/* Action Header Bar (hidden in print) */}
        <div className="px-6 py-3.5 bg-slate-100 border-b border-slate-200 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="material-symbols-outlined text-secondary">receipt_long</span>
            <span className="font-bold text-sm">
              Reçu d'Encaissement & de Paiement — Format Officiel
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Enregistrer une copie PDF"
            >
              <span className="material-symbols-outlined text-base text-rose-600">picture_as_pdf</span>
              <span>Exporter PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-secondary hover:bg-secondary/90 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Imprimer le reçu"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>Imprimer</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div
          id="printable-receipt"
          className="p-8 sm:p-10 space-y-6 bg-white min-h-[550px] flex flex-col justify-between"
        >
          {/* Official Clinic Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                Dr Mohamed Amrani - Chirurgien-Dentiste
              </h1>
              <p className="text-xs font-bold text-secondary uppercase tracking-wider mt-0.5">
                Cabinet Dentaire Médico-Chirurgical DentaFlow
              </p>
              <p className="text-[11px] font-semibold text-slate-700 mt-0.5">
                N° Ordre des Dentistes: 16/XXXX
              </p>
              <p className="text-[11px] text-slate-600 mt-1">
                14, Boulevard Colonel Amirouche, Alger Centre, 16000 Alger
              </p>
              <p className="text-[11px] text-slate-600">
                Tél : <span className="font-semibold">0550 12 34 56</span> · Fixe :{' '}
                <span className="font-semibold">021 65 43 21</span>
              </p>
            </div>

            <div className="text-right">
              <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg ml-auto mb-1">
                <span className="material-symbols-outlined text-2xl">payments</span>
              </div>
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                Reçu d'Encaissement
              </span>
              <span className="font-mono text-xs font-bold text-secondary block mt-0.5">
                N° {receiptNumber}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Date : {payment.date}</span>
            </div>
          </div>

          {/* Patient Details & Payment Information */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Reçu de (Patient)</span>
                <p className="text-base font-extrabold text-slate-900">
                  {patient.firstName} {patient.lastName}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400">Dossier N°</span>
                <p className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-slate-200 text-slate-800">
                  {patient.patientNumber}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">Téléphone</span>
                <span className="font-mono font-bold text-slate-800">{patient.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">Mode de Règlement</span>
                <span className="font-bold text-slate-800">{paymentMethodLabel}</span>
              </div>
              {invoice && (
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px] font-semibold">Facture Associée</span>
                  <span className="font-mono font-semibold text-slate-800">
                    Facture N° {invoice.invoiceNumber} (Total : {invoice.totalAmount.toLocaleString()} DA)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Amount Box */}
          <div className="border-2 border-secondary/40 rounded-xl p-5 bg-secondary-fixed/15 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs uppercase font-extrabold text-slate-700 tracking-wider">
                Montant Reçu :
              </span>
              <span className="text-2xl font-black font-mono text-secondary">
                {payment.amount.toLocaleString()} DA
              </span>
            </div>
            <div className="pt-2 border-t border-secondary/20 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                La somme de (en toutes lettres) :
              </span>
              <p className="text-xs font-bold text-slate-900 italic mt-0.5">
                « {amountInWords} »
              </p>
            </div>
            {payment.notes && (
              <div className="pt-1 text-[11px] text-slate-600">
                <span className="font-semibold">Observation : </span>
                <span>{payment.notes}</span>
              </div>
            )}
          </div>

          {/* Legal statement & Signature Box */}
          <div className="pt-4 flex flex-col sm:flex-row justify-between items-end gap-6">
            <div className="text-[10px] text-slate-500 max-w-xs space-y-1">
              <p className="font-semibold text-slate-700">
                Ce reçu atteste du bon encaissement de la somme susmentionnée.
              </p>
              <p>Valable et délivré pour servir et valoir ce que de droit.</p>
            </div>

            {/* Stamp and Signature Box */}
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 w-60 h-28 flex flex-col justify-between text-center bg-slate-50/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Zone Cachet & Signature du Praticien
              </span>
              <div className="text-[11px] font-bold text-slate-800">
                Dr Mohamed Amrani
                <span className="block text-[9px] font-medium text-slate-500">
                  Chirurgien-Dentiste
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
