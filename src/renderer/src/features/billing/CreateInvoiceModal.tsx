import React, { useState, useEffect, useMemo } from 'react'
import { Patient, MedicalAct, Invoice } from '@shared/types'
import { patientService } from '../../services/patientService'
import { billingService } from '../../services/billingService'
import { useToast } from '../../context/ToastContext'

interface CreateInvoiceModalProps {
  initialPatientId?: string
  onClose: () => void
  onSuccess: (savedInvoice: Invoice, shouldPrint?: boolean) => void
}

interface InvoiceItemDraft {
  id: string
  description: string
  actCode?: string
  quantity: number
  unitPrice: number
  amount: number
}

export default function CreateInvoiceModal({
  initialPatientId,
  onClose,
  onSuccess
}: CreateInvoiceModalProps): JSX.Element {
  const { showToast } = useToast()

  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string>(initialPatientId || '')
  const [patientSearch, setPatientSearch] = useState<string>('')
  const [patientDebts, setPatientDebts] = useState<number>(0)
  const [isLoadingDebts, setIsLoadingDebts] = useState<boolean>(false)

  // Medical Acts Catalog
  const [medicalActs, setMedicalActs] = useState<MedicalAct[]>([])
  const [selectedActId, setSelectedActId] = useState<string>('')

  // Invoice Draft
  const [items, setItems] = useState<InvoiceItemDraft[]>([
    {
      id: 'default_item_1',
      description: 'Détartrage et polissage complet aux ultra-sons',
      actCode: 'DETARTRAGE',
      quantity: 1,
      unitPrice: 5000,
      amount: 5000
    },
    {
      id: 'default_item_2',
      description: 'Obturation composite photo-polymérisable 2 faces',
      actCode: 'COMP_2F',
      quantity: 1,
      unitPrice: 6000,
      amount: 6000
    }
  ])
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().split('T')[0]
  })
  const [discountDA, setDiscountDA] = useState<number>(1000)
  const [initialAcompteDA, setInitialAcompteDA] = useState<number>(5000)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHECK' | 'TRANSFER'>('CASH')

  // Custom Item Inputs
  const [customDesc, setCustomDesc] = useState<string>('Couronne céramo-métallique')
  const [customPrice, setCustomPrice] = useState<number>(18000)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Load Patients and Medical Acts
  useEffect(() => {
    patientService.getPatients().then((list) => {
      setPatients(list)
      if (list.length > 0 && !selectedPatientId) {
        setSelectedPatientId(list[0].id)
      }
    }).catch(console.error)
    billingService.getMedicalActs().then(setMedicalActs).catch(console.error)
  }, [])

  // Load Patient Previous Debts when a patient is selected
  useEffect(() => {
    if (!selectedPatientId) {
      setPatientDebts(0)
      return
    }
    setIsLoadingDebts(true)
    billingService
      .getInvoices(selectedPatientId)
      .then((invs) => {
        const totalUnpaid = invs.reduce((sum, inv) => sum + (inv.remainingAmount || 0), 0)
        setPatientDebts(totalUnpaid)
      })
      .catch(console.error)
      .finally(() => setIsLoadingDebts(false))
  }, [selectedPatientId])

  const selectedPatient = patients.find((p) => p.id === selectedPatientId)

  // Filter patients
  const filteredPatients = patients.filter((p) => {
    const q = patientSearch.toLowerCase().trim()
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      p.patientNumber.toLowerCase().includes(q)
    )
  })

  // Add Act from Catalog
  const handleAddActFromCatalog = (): void => {
    if (!selectedActId) return
    const act = medicalActs.find((a) => a.id === selectedActId)
    if (!act) return

    const newItem: InvoiceItemDraft = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      description: act.name,
      actCode: act.code,
      quantity: 1,
      unitPrice: act.defaultPrice,
      amount: act.defaultPrice
    }

    setItems((prev) => [...prev, newItem])
    setSelectedActId('')
  }

  // Add Custom Item
  const handleAddCustomItem = (): void => {
    if (!customDesc.trim()) {
      showToast('Veuillez indiquer la désignation du soin', 'warning')
      return
    }
    if (customPrice <= 0) {
      showToast('Veuillez indiquer un prix valide en DA', 'warning')
      return
    }

    const newItem: InvoiceItemDraft = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      description: customDesc.trim(),
      quantity: 1,
      unitPrice: customPrice,
      amount: customPrice
    }

    setItems((prev) => [...prev, newItem])
    setCustomDesc('')
    setCustomPrice(0)
  }

  // Remove Item
  const handleRemoveItem = (id: string): void => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  // Update item quantity or unit price
  const handleUpdateItem = (id: string, qty: number, price: number): void => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        const newQty = Math.max(1, qty)
        const newPrice = Math.max(0, price)
        return {
          ...it,
          quantity: newQty,
          unitPrice: newPrice,
          amount: newQty * newPrice
        }
      })
    )
  }

  // Financial Computations
  const subtotalDA = useMemo(() => {
    return items.reduce((acc, it) => acc + it.amount, 0)
  }, [items])

  const netTotalDA = useMemo(() => {
    return Math.max(0, subtotalDA - (discountDA || 0))
  }, [subtotalDA, discountDA])

  const remainingDebtDA = useMemo(() => {
    return Math.max(0, netTotalDA - (initialAcompteDA || 0))
  }, [netTotalDA, initialAcompteDA])

  // Save Invoice
  const handleSave = async (shouldPrint: boolean = false): Promise<void> => {
    if (!selectedPatient) {
      showToast('Veuillez sélectionner un patient.', 'warning')
      return
    }
    if (items.length === 0) {
      showToast('Veuillez ajouter au moins un acte ou soin dentaire.', 'warning')
      return
    }
    if (initialAcompteDA > netTotalDA) {
      showToast("L'acompte ne peut pas excéder le montant net à payer.", 'warning')
      return
    }

    setIsSubmitting(true)
    try {
      const itemsPayload = items.map((it) => ({
        description: it.description,
        actCode: it.actCode,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        amount: it.amount
      }))

      // If discount was applied, append it to items metadata
      if (discountDA > 0) {
        itemsPayload.push({
          description: `Remise commerciale accordée (-${discountDA.toLocaleString()} DA)`,
          actCode: undefined,
          quantity: 1,
          unitPrice: -discountDA,
          amount: -discountDA
        })
      }

      const saved = await billingService.saveInvoice({
        patientId: selectedPatient.id,
        patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
        date,
        dueDate: dueDate || undefined,
        totalAmount: netTotalDA,
        paidAmount: initialAcompteDA,
        paymentMethod: initialAcompteDA > 0 ? paymentMethod : undefined,
        itemsJson: JSON.stringify(itemsPayload)
      })

      showToast(`Facture ${saved.invoiceNumber} enregistrée avec succès !`, 'success')
      onSuccess(saved, shouldPrint)
      onClose()
    } catch (err) {
      console.error('Failed to create invoice:', err)
      showToast("Erreur lors de l'enregistrement de la facture", 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-surface-container-lowest w-full max-w-4xl rounded-2xl shadow-2xl border border-outline-variant overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant/60 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-fixed text-secondary flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <div>
              <h3 className="font-bold text-base text-on-surface">
                Établir une Facture / Note d'Honoraires
              </h3>
              <p className="text-xs text-on-surface-variant font-medium">
                Catalogue officiel d'actes dentaires algériens (DA) · Remises & Encaissements
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Patient Selection Card */}
          <div className="p-4 rounded-xl border border-outline-variant/60 bg-surface space-y-3">
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
              Patient Destinataire <span className="text-error">*</span>
            </label>

            {selectedPatient ? (
              <div className="p-3.5 rounded-xl bg-secondary-fixed/30 border border-secondary/30 flex justify-between items-center">
                <div>
                  <div className="text-sm font-bold text-on-surface">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </div>
                  <div className="text-xs text-on-surface-variant font-mono mt-0.5">
                    N° Dossier : <span className="font-bold text-secondary">{selectedPatient.patientNumber}</span> · Tél : {selectedPatient.phone}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPatientId('')}
                  className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-container text-xs font-semibold text-secondary transition-colors cursor-pointer"
                >
                  Changer de patient
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Rechercher patient par nom, téléphone, matricule DZ-2026-XXXX..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-secondary"
                  />
                </div>

                {patientSearch && (
                  <div className="max-h-36 overflow-y-auto border border-outline-variant/60 rounded-xl bg-surface-container-lowest divide-y divide-outline-variant/30 shadow-xs">
                    {filteredPatients.slice(0, 5).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatientId(p.id)
                          setPatientSearch('')
                        }}
                        className="w-full text-left p-2.5 hover:bg-secondary-fixed/30 text-xs flex justify-between items-center transition-colors cursor-pointer"
                      >
                        <div>
                          <span className="font-bold text-on-surface">{p.firstName} {p.lastName}</span>
                          <span className="text-outline text-[11px] ml-2">({p.phone})</span>
                        </div>
                        <span className="font-mono text-[10px] text-secondary font-bold">{p.patientNumber}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Existing Debts Warning Banner */}
            {selectedPatient && patientDebts > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-900 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-700 text-lg">account_balance_wallet</span>
                  <span>
                    Dettes & Créances antérieures non soldées : <strong>{patientDebts.toLocaleString()} DA</strong>
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-amber-800">
                  À cumuler au dossier
                </span>
              </div>
            )}
          </div>

          {/* Add Acts from Catalog / Custom */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
              Ajouter des Actes & Soins Dentaires
            </label>

            {/* Catalog Selector */}
            <div className="flex gap-2">
              <select
                value={selectedActId}
                onChange={(e) => setSelectedActId(e.target.value)}
                className="flex-1 h-10 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface font-medium focus:outline-none focus:border-secondary cursor-pointer"
              >
                <option value="">-- Choisir un acte dans le catalogue (Consultation, Détartrage, Composite, Couronne...) --</option>
                {medicalActs.map((act) => (
                  <option key={act.id} value={act.id}>
                    [{act.code}] {act.name} — {act.defaultPrice.toLocaleString()} DA
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedActId}
                onClick={handleAddActFromCatalog}
                className="px-4 h-10 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-base">add</span>
                <span>+ Ajouter l'acte</span>
              </button>
            </div>

            {/* Custom line item */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Autre soin ou libellé personnalisé..."
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                className="flex-1 h-9 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface"
              />
              <input
                type="number"
                placeholder="Tarif DA"
                value={customPrice || ''}
                onChange={(e) => setCustomPrice(Number(e.target.value))}
                className="w-32 h-9 px-3 rounded-xl bg-surface border border-outline-variant text-xs font-mono text-on-surface"
              />
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="px-3 h-9 rounded-xl border border-outline-variant hover:bg-surface-container text-xs font-semibold text-on-surface transition-colors cursor-pointer shrink-0"
              >
                + Ligne libre
              </button>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                Lignes de la Facture ({items.length})
              </label>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="text-[11px] text-error hover:underline cursor-pointer"
                >
                  Tout supprimer
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-outline-variant text-center text-xs text-on-surface-variant bg-surface space-y-1">
                <span className="material-symbols-outlined text-2xl text-outline block">playlist_add</span>
                <p>Aucun acte ajouté. Sélectionnez un acte ci-dessus pour composer la facture.</p>
              </div>
            ) : (
              <div className="border border-outline-variant/60 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] font-bold border-b border-outline-variant/40">
                    <tr>
                      <th className="py-2.5 px-3">Désignation</th>
                      <th className="py-2.5 px-3 text-center w-24">Quantité</th>
                      <th className="py-2.5 px-3 text-right w-32">Prix Unitaire (DA)</th>
                      <th className="py-2.5 px-3 text-right w-32">Montant (DA)</th>
                      <th className="py-2.5 px-2 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30 bg-surface">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-container/30">
                        <td className="py-2 px-3 font-medium text-on-surface">
                          {item.description}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateItem(item.id, Number(e.target.value), item.unitPrice)
                            }
                            className="w-16 h-7 px-1.5 text-center font-mono rounded-lg bg-surface-container-lowest border border-outline-variant text-xs text-on-surface"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="500"
                            value={item.unitPrice}
                            onChange={(e) =>
                              handleUpdateItem(item.id, item.quantity, Number(e.target.value))
                            }
                            className="w-28 h-7 px-2 text-right font-mono rounded-lg bg-surface-container-lowest border border-outline-variant text-xs text-on-surface"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-on-surface">
                          {item.amount.toLocaleString()} DA
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1 text-outline hover:text-error transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Dates & Financial Settlement Bento Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-outline-variant/60">
            {/* Left: Dates & Payment Method */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Date d'émission
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Échéance (optionnel)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Mode de règlement (pour l'acompte)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                      paymentMethod === 'CASH'
                        ? 'bg-secondary text-on-secondary border-secondary shadow-xs'
                        : 'border-outline-variant bg-surface text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">payments</span>
                    <span>Espèces</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CHECK')}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                      paymentMethod === 'CHECK'
                        ? 'bg-secondary text-on-secondary border-secondary shadow-xs'
                        : 'border-outline-variant bg-surface text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">receipt</span>
                    <span>Chèque</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('TRANSFER')}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                      paymentMethod === 'TRANSFER'
                        ? 'bg-secondary text-on-secondary border-secondary shadow-xs'
                        : 'border-outline-variant bg-surface text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">account_balance</span>
                    <span>Virement</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Totals, Discounts & Deposit */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 space-y-2 text-xs">
              <div className="flex justify-between items-center text-on-surface-variant font-medium">
                <span>Total Brut des Soins :</span>
                <span className="font-mono font-bold text-on-surface">
                  {subtotalDA.toLocaleString()} DA
                </span>
              </div>

              {/* Remise accordée */}
              <div className="flex justify-between items-center gap-2">
                <span className="text-secondary font-semibold">Remise accordée (DA) :</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={discountDA || ''}
                  placeholder="0 DA"
                  onChange={(e) => setDiscountDA(Math.max(0, Number(e.target.value)))}
                  className="w-32 h-8 px-2 text-right font-mono font-bold rounded-lg bg-surface border border-outline-variant text-xs text-secondary focus:outline-none focus:border-secondary"
                />
              </div>

              {/* Net à Payer */}
              <div className="flex justify-between items-center text-sm font-black border-t border-outline-variant/40 pt-2 text-on-surface">
                <span>Montant Net à Payer :</span>
                <span className="font-mono text-base text-primary">
                  {netTotalDA.toLocaleString()} DA
                </span>
              </div>

              {/* Acompte immédiat */}
              <div className="flex justify-between items-center gap-2 border-t border-outline-variant/40 pt-2 text-emerald-800">
                <span className="font-bold">Acompte immédiat perçu :</span>
                <input
                  type="number"
                  min="0"
                  max={netTotalDA}
                  step="500"
                  value={initialAcompteDA || ''}
                  placeholder="0 DA"
                  onChange={(e) => setInitialAcompteDA(Math.max(0, Number(e.target.value)))}
                  className="w-32 h-8 px-2 text-right font-mono font-bold rounded-lg bg-surface border border-emerald-300 text-xs text-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Solde restant / Dette */}
              <div className="flex justify-between items-center border-t border-outline-variant/40 pt-2">
                <span className="font-bold text-pending-orange">Reste à payer (Dette) :</span>
                <span className={`font-mono font-black text-sm ${remainingDebtDA > 0 ? 'text-pending-orange' : 'text-on-surface-variant'}`}>
                  {remainingDebtDA.toLocaleString()} DA
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant/60 flex justify-between items-center shrink-0">
          <span className="text-xs text-on-surface-variant">
            Net : <strong className="text-on-surface font-mono">{netTotalDA.toLocaleString()} DA</strong>
            {initialAcompteDA > 0 && (
              <span className="ml-2 text-emerald-700 font-semibold font-mono">
                (Acompte : {initialAcompteDA.toLocaleString()} DA)
              </span>
            )}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="button"
              disabled={isSubmitting || items.length === 0 || !selectedPatient}
              onClick={() => handleSave(false)}
              className="px-4 py-2 rounded-xl border border-secondary text-secondary hover:bg-secondary-fixed/50 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
            >
              Enregistrer
            </button>

            <button
              type="button"
              disabled={isSubmitting || items.length === 0 || !selectedPatient}
              onClick={() => handleSave(true)}
              className="px-5 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer & Imprimer'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
