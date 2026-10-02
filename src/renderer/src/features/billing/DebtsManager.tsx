import React, { useState, useEffect } from 'react'
import { Patient, Invoice, Payment } from '@shared/types'
import { patientService } from '../../services/patientService'
import { billingService } from '../../services/billingService'
import RecordPaymentModal from './RecordPaymentModal'
import PrintableReceiptModal from './PrintableReceiptModal'

interface PatientDebtItem {
  patient: Patient
  totalBilledDA: number
  totalPaidDA: number
  remainingDebtDA: number
  unpaidInvoicesCount: number
}

export default function DebtsManager(): JSX.Element {
  const [debtsList, setDebtsList] = useState<PatientDebtItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedPatientForPayment, setSelectedPatientForPayment] = useState<Patient | null>(null)
  const [lastPaymentReceipt, setLastPaymentReceipt] = useState<{
    payment: Payment
    patient: Patient
  } | null>(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)

  const loadDebts = async (): Promise<void> => {
    try {
      const [patients, invoices] = await Promise.all([
        patientService.getPatients(),
        billingService.getInvoices()
      ])

      const list: PatientDebtItem[] = []

      patients.forEach((p) => {
        const patientInvoices = invoices.filter((i) => i.patientId === p.id)
        const totalBilledDA = patientInvoices.reduce((acc, i) => acc + (i.totalAmount || 0), 0)
        const totalPaidDA = patientInvoices.reduce((acc, i) => acc + (i.paidAmount || 0), 0)
        const remainingDebtDA = patientInvoices.reduce((acc, i) => acc + (i.remainingAmount || 0), 0)
        const unpaidCount = patientInvoices.filter((i) => i.remainingAmount > 0).length

        if (remainingDebtDA > 0) {
          list.push({
            patient: p,
            totalBilledDA,
            totalPaidDA,
            remainingDebtDA,
            unpaidInvoicesCount: unpaidCount
          })
        }
      })

      // Sort by highest debt first
      list.sort((a, b) => b.remainingDebtDA - a.remainingDebtDA)
      setDebtsList(list)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDebts()
  }, [])

  const filteredDebts = debtsList.filter(
    (d) =>
      d.patient.firstName.toLowerCase().includes(search.toLowerCase()) ||
      d.patient.lastName.toLowerCase().includes(search.toLowerCase()) ||
      d.patient.phone.includes(search) ||
      d.patient.patientNumber.toLowerCase().includes(search.toLowerCase())
  )

  const totalOutstandingDA = debtsList.reduce((acc, d) => acc + d.remainingDebtDA, 0)

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-pending-orange">account_balance_wallet</span>
            <span>Gestion des Créances & Dettes Patients</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold">
              {debtsList.length} patients débiteurs
            </span>
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Suivi des relances et recouvrement des soins dentaires en Dinars Algériens (DA).
          </p>
        </div>

        <div className="text-right bg-amber-50 border border-amber-200 p-3 rounded-xl">
          <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
            Total Créances à Recouvrer
          </span>
          <span className="text-lg font-bold font-mono text-pending-orange">
            {totalOutstandingDA.toLocaleString()} DA
          </span>
        </div>
      </div>

      {/* Payment Success & Receipt Print Banner */}
      {lastPaymentReceipt && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">check_circle</span>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-950">
                Paiement de {lastPaymentReceipt.payment.amount.toLocaleString()} DA enregistré pour{' '}
                <strong className="underline">{lastPaymentReceipt.patient.firstName} {lastPaymentReceipt.patient.lastName}</strong>
                {' · '}Reçu N° {lastPaymentReceipt.payment.receiptNumber || 'REC-2026-XXXX'}
              </p>
              <p className="text-[11px] text-emerald-700">
                Le solde a été mis à jour immédiatement (0 DA si soldé) et la facture est désormais Réglée.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowReceiptModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              <span>Imprimer le Reçu d'Encaissement</span>
            </button>
            <button
              onClick={() => setLastPaymentReceipt(null)}
              className="p-1 text-emerald-700 hover:text-emerald-950 rounded-lg hover:bg-emerald-200/50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter and Table */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative w-72">
            <input
              type="text"
              placeholder="Filtrer par nom, téléphone (05/06/07)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-base">
              search
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center items-center gap-2 text-secondary">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            <span className="text-xs font-medium">Chargement des créances...</span>
          </div>
        ) : filteredDebts.length === 0 ? (
          <div className="py-16 text-center text-on-surface-variant text-xs space-y-2">
            <span className="material-symbols-outlined text-4xl text-on-tertiary-container">
              verified
            </span>
            <p className="font-semibold text-on-surface">Aucune créance en attente.</p>
            <p className="text-outline">Toutes les factures des patients sont actuellement réglées.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-outline-variant/40 text-on-surface-variant font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Patient</th>
                  <th className="py-3 px-3">Téléphone</th>
                  <th className="py-3 px-3 text-right">Facturé (DA)</th>
                  <th className="py-3 px-3 text-right">Déjà Payé (DA)</th>
                  <th className="py-3 px-3 text-right">Dette Restante (DA)</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {filteredDebts.map((item) => (
                  <tr key={item.patient.id} className="hover:bg-surface-container/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-on-surface">
                        {item.patient.firstName} {item.patient.lastName}
                      </div>
                      <span className="text-[11px] font-mono text-outline">
                        {item.patient.patientNumber}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-on-surface">
                      <a
                        href={`tel:${item.patient.phone}`}
                        className="flex items-center gap-1 text-secondary hover:underline"
                      >
                        <span className="material-symbols-outlined text-sm">phone</span>
                        <span>{item.patient.phone}</span>
                      </a>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-on-surface">
                      {item.totalBilledDA.toLocaleString()} DA
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-on-tertiary-container font-semibold">
                      {item.totalPaidDA.toLocaleString()} DA
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-pending-orange text-sm">
                      {item.remainingDebtDA.toLocaleString()} DA
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setSelectedPatientForPayment(item.patient)}
                        className="px-3 py-1.5 rounded-xl bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary text-xs font-bold shadow-xs transition-all cursor-pointer"
                      >
                        + Encaisser
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Drawer Modal */}
      {selectedPatientForPayment && (
        <RecordPaymentModal
          initialPatientId={selectedPatientForPayment.id}
          initialPatient={selectedPatientForPayment}
          onClose={() => setSelectedPatientForPayment(null)}
          onSuccess={(payment) => {
            loadDebts()
            if (selectedPatientForPayment) {
              setLastPaymentReceipt({
                payment,
                patient: selectedPatientForPayment
              })
            }
          }}
        />
      )}

      {/* Printable Receipt Modal */}
      {showReceiptModal && lastPaymentReceipt && (
        <PrintableReceiptModal
          payment={lastPaymentReceipt.payment}
          patient={lastPaymentReceipt.patient}
          onClose={() => setShowReceiptModal(false)}
        />
      )}
    </div>
  )
}
