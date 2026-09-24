import React, { useState, useEffect } from 'react'
import { Invoice } from '@shared/types'
import { billingService } from '../../services/billingService'
import RecordPaymentModal from './RecordPaymentModal'
import CreateInvoiceModal from './CreateInvoiceModal'
import PrintableInvoice from './PrintableInvoice'

export default function InvoiceListView(): JSX.Element {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [printableInvoice, setPrintableInvoice] = useState<Invoice | null>(null)

  const loadInvoices = async (): Promise<void> => {
    try {
      const list = await billingService.getInvoices()
      setInvoices(list)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadInvoices()
  }, [])

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.patientName.toLowerCase().includes(searchTerm.toLowerCase())
    if (!matchesSearch) return false

    if (filter === 'UNPAID') return inv.remainingAmount > 0
    if (filter === 'PAID') return inv.remainingAmount === 0 || inv.status === 'PAID'
    return true
  })

  const totalBilled = invoices.reduce((acc, i) => acc + (i.totalAmount || 0), 0)
  const totalPaid = invoices.reduce((acc, i) => acc + (i.paidAmount || 0), 0)
  const totalDebts = invoices.reduce((acc, i) => acc + (i.remainingAmount || 0), 0)

  const getStatusBadge = (inv: Invoice): JSX.Element => {
    if (inv.status === 'PAID' || inv.remainingAmount === 0) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-tertiary-fixed text-on-tertiary-container flex items-center gap-1 w-fit">
          <span className="material-symbols-outlined text-xs">check_circle</span>
          Réglée
        </span>
      )
    }
    if (inv.paidAmount > 0 && inv.remainingAmount > 0) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 flex items-center gap-1 w-fit">
          <span className="material-symbols-outlined text-xs">hourglass_top</span>
          Partielle ({inv.paidAmount.toLocaleString()} DA)
        </span>
      )
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-error-container text-error flex items-center gap-1 w-fit">
        <span className="material-symbols-outlined text-xs">error</span>
        Non Payée
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Financial KPI Bento Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-outline uppercase tracking-wider">
              Total Facturé
            </span>
            <span className="material-symbols-outlined text-secondary text-xl">receipt_long</span>
          </div>
          <div className="text-xl font-bold font-mono text-on-surface mt-2">
            {totalBilled.toLocaleString()} DA
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1 block">
            Sur l'ensemble des dossiers
          </span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-outline uppercase tracking-wider">
              Total Encaissé
            </span>
            <span className="material-symbols-outlined text-on-tertiary-container text-xl">
              payments
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-on-tertiary-container mt-2">
            {totalPaid.toLocaleString()} DA
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1 block">
            Règlements perçus en caisse
          </span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-outline uppercase tracking-wider">
              Créances & Dettes Patients
            </span>
            <span className="material-symbols-outlined text-pending-orange text-xl">
              account_balance_wallet
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-pending-orange mt-2">
            {totalDebts.toLocaleString()} DA
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1 block">
            Reste à recouvrer auprès des patients
          </span>
        </div>
      </div>

      {/* 2. Invoices List Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-xs space-y-4">
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-on-surface">Facturation & Recouvrement</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-semibold">
              {filteredInvoices.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Filter Pills */}
            <div className="flex bg-surface rounded-xl border border-outline-variant/60 p-0.5 text-xs">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filter === 'ALL'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Toutes
              </button>
              <button
                onClick={() => setFilter('UNPAID')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filter === 'UNPAID'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Dettes / Impayées
              </button>
              <button
                onClick={() => setFilter('PAID')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filter === 'PAID'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Réglées
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher facture, patient..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 pl-8 pr-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface"
              />
              <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-outline text-base">
                search
              </span>
            </div>

            {/* Create Invoice Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>Nouvelle Facture</span>
            </button>
          </div>
        </div>

        {/* Invoices Table */}
        {isLoading ? (
          <div className="py-16 flex justify-center items-center gap-2 text-secondary">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            <span className="text-xs font-medium">Chargement des factures...</span>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-16 text-center text-on-surface-variant text-xs space-y-2">
            <span className="material-symbols-outlined text-4xl text-outline">receipt</span>
            <p>Aucune facture trouvée pour ce critère.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-outline-variant/40 text-on-surface-variant font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Réf. Facture</th>
                  <th className="py-3 px-3">Patient</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Statut</th>
                  <th className="py-3 px-3 text-right">Total (DA)</th>
                  <th className="py-3 px-3 text-right">Payé (DA)</th>
                  <th className="py-3 px-3 text-right">Reste / Dette</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-container/50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-secondary">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-3 font-semibold text-on-surface">{inv.patientName}</td>
                    <td className="py-3 px-3 text-on-surface-variant">{inv.date}</td>
                    <td className="py-3 px-3">{getStatusBadge(inv)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-on-surface">
                      {inv.totalAmount.toLocaleString()} DA
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-on-tertiary-container font-semibold">
                      {inv.paidAmount.toLocaleString()} DA
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-pending-orange">
                      {inv.remainingAmount > 0 ? `${inv.remainingAmount.toLocaleString()} DA` : '0 DA'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {inv.remainingAmount > 0 ? (
                          <button
                            onClick={() => setPaymentModalInvoice(inv)}
                            className="px-2.5 py-1 rounded-lg bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                            title="Encaisser un paiement"
                          >
                            + Encaisser
                          </button>
                        ) : (
                          <span className="text-[11px] text-outline italic">Soldée</span>
                        )}
                        <button
                          onClick={() => setPrintableInvoice(inv)}
                          className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-secondary transition-colors cursor-pointer"
                          title="Imprimer la facture / reçu"
                        >
                          <span className="material-symbols-outlined text-base">print</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {paymentModalInvoice && (
        <RecordPaymentModal
          initialPatientId={paymentModalInvoice.patientId}
          initialInvoiceId={paymentModalInvoice.id}
          defaultAmount={paymentModalInvoice.remainingAmount}
          onClose={() => setPaymentModalInvoice(null)}
          onSuccess={() => {
            loadInvoices()
          }}
        />
      )}

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <CreateInvoiceModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(createdInvoice) => {
            loadInvoices()
            setPrintableInvoice(createdInvoice)
          }}
        />
      )}

      {/* Printable Invoice Modal */}
      {printableInvoice && (
        <PrintableInvoice
          invoice={printableInvoice}
          onClose={() => setPrintableInvoice(null)}
        />
      )}
    </div>
  )
}
