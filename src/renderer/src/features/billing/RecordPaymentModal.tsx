import React, { useState, useEffect } from 'react'
import { Patient, Invoice, Payment } from '@shared/types'
import { billingService } from '../../services/billingService'
import { patientService } from '../../services/patientService'

interface RecordPaymentModalProps {
  initialPatientId?: string
  initialInvoiceId?: string
  defaultAmount?: number
  onClose: () => void
  onSuccess: (payment: Payment) => void
}

export default function RecordPaymentModal({
  initialPatientId,
  initialInvoiceId,
  defaultAmount,
  onClose,
  onSuccess
}: RecordPaymentModalProps): JSX.Element {
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientId, setPatientId] = useState(initialPatientId || '')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId || '')
  const [amount, setAmount] = useState<number>(defaultAmount || 3000)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [method, setMethod] = useState<Payment['method']>('CASH')
  const [notes, setNotes] = useState('Règlement reçu en espèces à la caisse du cabinet')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    patientService.getPatients().then((list) => {
      setPatients(list)
      if (!patientId && list.length > 0) {
        setPatientId(list[0].id)
      }
    })
  }, [])

  useEffect(() => {
    if (patientId) {
      billingService.getInvoices(patientId).then((invList) => {
        setInvoices(invList)
        if (invList.length > 0 && !invoiceId) {
          const unpaid = invList.find((i) => i.remainingAmount > 0)
          if (unpaid) {
            setInvoiceId(unpaid.id)
            if (!defaultAmount) setAmount(unpaid.remainingAmount)
          }
        }
      })
    }
  }, [patientId])

  const selectedPatient = patients.find((p) => p.id === patientId)
  const selectedInvoice = invoices.find((i) => i.id === invoiceId)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!patientId || amount <= 0) return

    setIsSubmitting(true)
    try {
      const result = await billingService.recordPayment({
        patientId,
        invoiceId: invoiceId || undefined,
        amount: Number(amount),
        date,
        method,
        notes
      })
      onSuccess(result)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex justify-end">
      <div className="w-full sm:w-[440px] bg-surface-container-lowest h-full flex flex-col shadow-2xl border-l border-outline-variant animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-outline-variant/60 flex items-center justify-between bg-surface-container-low shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-tertiary-fixed text-on-tertiary-container flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">payments</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-on-surface">Enregistrer un Paiement</h2>
              <span className="text-xs text-on-surface-variant font-medium">Caisse & Règlements (DA)</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Patient Selection */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Patient
            </label>
            {initialPatientId && selectedPatient ? (
              <div className="p-3 rounded-xl bg-surface border border-outline-variant/60 flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-on-surface">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </div>
                  <div className="text-[11px] text-outline font-mono">{selectedPatient.patientNumber}</div>
                </div>
              </div>
            ) : (
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface cursor-pointer"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} ({p.patientNumber})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Invoice Selection if available */}
          {invoices.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                Imputer à une facture (Optionnel)
              </label>
              <select
                value={invoiceId}
                onChange={(e) => {
                  setInvoiceId(e.target.value)
                  const inv = invoices.find((i) => i.id === e.target.value)
                  if (inv) setAmount(inv.remainingAmount)
                }}
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface cursor-pointer"
              >
                <option value="">Règlement libre / Solde global</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} — Reste: {inv.remainingAmount.toLocaleString()} DA (Total: {inv.totalAmount.toLocaleString()} DA)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Amount in Dinars */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Montant versé (DA) <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="100"
                step="100"
                required
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="Ex: 5000"
                className="w-full h-11 pl-3 pr-10 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm font-bold text-on-surface font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-secondary">
                DA
              </span>
            </div>
            {selectedInvoice && (
              <span className="text-[11px] text-outline mt-1 block">
                Reste à payer sur cette facture :{' '}
                <strong className="text-pending-orange">{selectedInvoice.remainingAmount.toLocaleString()} DA</strong>
              </span>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Mode de Règlement
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'CASH', label: 'Espèces', icon: 'payments' },
                { val: 'CHECK', label: 'Chèque', icon: 'receipt' },
                { val: 'TRANSFER', label: 'BaridiMob / Vir.', icon: 'account_balance' }
              ].map((m) => (
                <button
                  key={m.val}
                  type="button"
                  onClick={() => setMethod(m.val as Payment['method'])}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    method === m.val
                      ? 'border-secondary bg-secondary-fixed/40 text-on-surface ring-1 ring-secondary'
                      : 'border-outline-variant/60 text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg mb-1">{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Date d'encaissement
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Référence / N° de Reçu / Remarque
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Reçu N° 459, versé par le frère..."
              className="w-full p-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-outline-variant/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || amount <= 0}
              className="px-5 py-2 rounded-xl bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{isSubmitting ? 'Enregistrement...' : 'Valider l’encaissement'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
