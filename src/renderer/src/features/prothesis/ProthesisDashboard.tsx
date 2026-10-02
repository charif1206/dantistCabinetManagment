import React, { useState, useEffect, useMemo } from 'react'
import {
  ProthesisOrder,
  ProstheticLaboratory,
  ProthesisOrderStatus,
  Patient
} from '@shared/types'
import { prothesisService } from '../../services/prothesisService'
import { patientService } from '../../services/patientService'
import { useToast } from '../../context/ToastContext'
import NewProthesisOrderModal from './NewProthesisOrderModal'
import PrintableLabSlip from './PrintableLabSlip'

const WORKFLOW_STEPS: {
  status: ProthesisOrderStatus
  label: string
  shortLabel: string
  icon: string
  colorClass: string
  badgeClass: string
}[] = [
  {
    status: 'PREPARATION',
    label: '1. Préparation / Empreinte',
    shortLabel: 'Préparation',
    icon: 'edit_note',
    colorClass: 'text-amber-600 bg-amber-50 border-amber-200',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-200'
  },
  {
    status: 'SENT',
    label: '2. Envoyé au laboratoire',
    shortLabel: 'En fabrication',
    icon: 'local_shipping',
    colorClass: 'text-sky-600 bg-sky-50 border-sky-200',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-200'
  },
  {
    status: 'RECEIVED',
    label: '3. Reçu du labo',
    shortLabel: 'Reçu au cabinet',
    icon: 'inventory_2',
    colorClass: 'text-purple-600 bg-purple-50 border-purple-200',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-200'
  },
  {
    status: 'FITTING',
    label: '4. Essayage en bouche',
    shortLabel: 'À essayer',
    icon: 'dentistry',
    colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-200'
  },
  {
    status: 'DELIVERED',
    label: '5. Posé / Livré définitif',
    shortLabel: 'Posé & Terminé',
    icon: 'check_circle',
    colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200'
  }
]

export default function ProthesisDashboard(): JSX.Element {
  const { showToast } = useToast()

  // State
  const [orders, setOrders] = useState<ProthesisOrder[]>([])
  const [labs, setLabs] = useState<ProstheticLaboratory[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLabFilter, setSelectedLabFilter] = useState<string>('ALL')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL')

  // Modals
  const [showNewOrderModal, setShowNewOrderModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState<ProthesisOrder | null>(null)
  const [printingOrder, setPrintingOrder] = useState<ProthesisOrder | null>(null)
  const [showManageLabsModal, setShowManageLabsModal] = useState(false)

  // Lab management form state
  const [newLabName, setNewLabName] = useState('')
  const [newLabPhone, setNewLabPhone] = useState('')
  const [newLabWilaya, setNewLabWilaya] = useState('Alger')
  const [newLabContact, setNewLabContact] = useState('')

  // Load all initial data
  const loadDashboardData = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const [orderList, labList, patientList] = await Promise.all([
        prothesisService.getOrders(),
        prothesisService.getLabs(),
        patientService.getPatients()
      ])
      setOrders(orderList)
      setLabs(labList)
      setPatients(patientList)
    } catch (err: any) {
      console.error('Error loading prothesis dashboard data:', err)
      showToast('Erreur de chargement des données de prothèse', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  // KPI Calculations
  const kpis = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const currentMonthPrefix = new Date().toISOString().slice(0, 7) // '2026-09'

    let inFabrication = 0
    let awaitingFitting = 0
    let delayed = 0
    let monthlyLabCostDA = 0

    orders.forEach((o) => {
      // 1. In fabrication
      if (o.status === 'SENT' || o.status === 'PREPARATION') {
        inFabrication++
      }

      // 2. Awaiting fitting
      if (o.status === 'RECEIVED' || o.status === 'FITTING') {
        awaitingFitting++
      }

      // 3. Delayed
      if (
        o.expectedDate &&
        o.expectedDate < todayStr &&
        o.status !== 'DELIVERED' &&
        o.status !== 'REJECTED'
      ) {
        delayed++
      }

      // 4. Monthly lab cost (current month)
      const orderDate = o.sentDate || o.createdAt
      if (orderDate && orderDate.startsWith(currentMonthPrefix)) {
        monthlyLabCostDA += o.labCostDA || 0
      }
    })

    return {
      inFabrication,
      awaitingFitting,
      delayed,
      monthlyLabCostDA
    }
  }, [orders])

  // Filtered orders
  const filteredOrders = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)

    return orders.filter((o) => {
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const matches =
          o.orderNumber.toLowerCase().includes(term) ||
          o.patientName.toLowerCase().includes(term) ||
          o.labName.toLowerCase().includes(term) ||
          o.actName.toLowerCase().includes(term) ||
          o.shade.toLowerCase().includes(term) ||
          (o.toothNumber && String(o.toothNumber).includes(term))
        if (!matches) return false
      }

      // Lab filter
      if (selectedLabFilter !== 'ALL' && o.labId !== selectedLabFilter) {
        return false
      }

      // Status filter
      if (selectedStatusFilter === 'DELAYED') {
        if (!o.expectedDate || o.expectedDate >= todayStr || o.status === 'DELIVERED') {
          return false
        }
      } else if (selectedStatusFilter !== 'ALL') {
        if (o.status !== selectedStatusFilter) return false
      }

      return true
    })
  }, [orders, searchTerm, selectedLabFilter, selectedStatusFilter])

  // Quick transition
  const handleQuickStatusChange = async (
    orderId: string,
    newStatus: ProthesisOrderStatus
  ): Promise<void> => {
    try {
      await prothesisService.updateOrderStatus(orderId, newStatus)
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      )
      showToast('Statut de la commande mis à jour', 'success')
    } catch (err: any) {
      showToast(`Erreur mise à jour statut : ${err?.message || 'Erreur'}`, 'error')
    }
  }

  // Delete order
  const handleDeleteOrder = async (id: string, num: string): Promise<void> => {
    if (window.confirm(`Supprimer définitivement la commande ${num} ?`)) {
      try {
        await prothesisService.deleteOrder(id)
        setOrders((prev) => prev.filter((o) => o.id !== id))
        showToast(`Commande ${num} supprimée`, 'info')
      } catch (err: any) {
        showToast(`Erreur suppression : ${err?.message || 'Erreur'}`, 'error')
      }
    }
  }

  // Add lab handler
  const handleAddLab = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newLabName.trim()) {
      showToast('Le nom du laboratoire est obligatoire', 'error')
      return
    }
    try {
      const created = await prothesisService.saveLab({
        name: newLabName.trim(),
        phone: newLabPhone.trim() || '0550000000',
        wilaya: newLabWilaya.trim() || 'Alger',
        contactPerson: newLabContact.trim() || null,
        active: 1
      })
      setLabs((prev) => [...prev, created])
      setNewLabName('')
      setNewLabPhone('')
      setNewLabContact('')
      showToast(`Laboratoire "${created.name}" ajouté avec succès`, 'success')
    } catch (err: any) {
      showToast(`Erreur ajout labo : ${err?.message || 'Erreur'}`, 'error')
    }
  }

  // Delete lab
  const handleDeleteLab = async (labId: string, labName: string): Promise<void> => {
    if (window.confirm(`Supprimer le laboratoire "${labName}" de la liste ?`)) {
      try {
        await prothesisService.deleteLab(labId)
        setLabs((prev) => prev.filter((l) => l.id !== labId))
        showToast(`Laboratoire "${labName}" supprimé`, 'info')
      } catch (err: any) {
        showToast(`Erreur suppression : ${err?.message || 'Erreur'}`, 'error')
      }
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-secondary">
            <span className="material-symbols-outlined text-2xl">precision_manufacturing</span>
            <span className="text-xs uppercase font-black tracking-wider">
              Module Sous-traitance & Laboratoires (Mylab)
            </span>
          </div>
          <h1 className="text-2xl font-black text-on-surface tracking-tight mt-0.5">
            Suivi des Prothèses & Commandes Labo
          </h1>
          <p className="text-xs text-on-surface-variant">
            Gestion du flux des empreintes, teintier clinique, essayages et coûts de laboratoire (DA)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowManageLabsModal(true)}
            className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-on-surface text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base text-secondary">domain</span>
            <span>Mylab & Partenaires ({labs.length})</span>
          </button>

          <button
            onClick={() => {
              setEditingOrder(null)
              setShowNewOrderModal(true)
            }}
            className="px-4 py-2 bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>+ Nouvelle Commande</span>
          </button>
        </div>
      </div>

      {/* 4 Upper KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: In Fabrication */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-on-surface-variant">En Fabrication au Labo</p>
            <p className="text-2xl font-black text-sky-600 mt-1">{kpis.inFabrication}</p>
            <span className="text-[11px] text-sky-700 font-medium">Empreintes envoyées</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center text-sky-700">
            <span className="material-symbols-outlined text-2xl">local_shipping</span>
          </div>
        </div>

        {/* KPI 2: Received / Awaiting Fitting */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-on-surface-variant">À Essayer en Bouche</p>
            <p className="text-2xl font-black text-indigo-600 mt-1">{kpis.awaitingFitting}</p>
            <span className="text-[11px] text-indigo-700 font-medium">Pièces reçues au cabinet</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
            <span className="material-symbols-outlined text-2xl">inventory_2</span>
          </div>
        </div>

        {/* KPI 3: Delayed Orders */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-on-surface-variant">Commandes en Retard</p>
            <p className="text-2xl font-black text-rose-600 mt-1">{kpis.delayed}</p>
            <span className="text-[11px] text-rose-700 font-medium">Date prévue dépassée</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700">
            <span className="material-symbols-outlined text-2xl">warning</span>
          </div>
        </div>

        {/* KPI 4: Monthly Lab Cost in DA */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-on-surface-variant">Dépenses Labo du Mois</p>
            <p className="text-2xl font-black text-on-surface mt-1">
              {kpis.monthlyLabCostDA.toLocaleString()}{' '}
              <span className="text-sm font-bold text-secondary">DA</span>
            </p>
            <span className="text-[11px] text-on-surface-variant font-medium">Coûts de fabrication dus</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-secondary-fixed/50 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-2xl">account_balance</span>
          </div>
        </div>
      </div>

      {/* Stepper Workflow Visual Indicator Banner */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-on-surface flex items-center gap-1.5 uppercase tracking-wide">
            <span className="material-symbols-outlined text-secondary text-base">alt_route</span>
            <span>Cycle de Vie Clinique d'une Pièce Prothétique</span>
          </span>
          <span className="text-[11px] text-on-surface-variant font-medium">
            5 étapes standardisées
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {WORKFLOW_STEPS.map((step, idx) => (
            <div
              key={step.status}
              onClick={() => setSelectedStatusFilter(step.status)}
              className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02] ${
                selectedStatusFilter === step.status
                  ? `${step.badgeClass} ring-2 ring-secondary/50 font-bold shadow-xs`
                  : 'bg-surface-container/60 border-outline-variant/40 hover:bg-surface-container text-on-surface'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  selectedStatusFilter === step.status ? 'bg-white/80' : 'bg-surface-container-highest'
                }`}
              >
                <span className="material-symbols-outlined text-base">{step.icon}</span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-on-surface-variant block font-mono">Étape {idx + 1}</span>
                <span className="text-xs font-semibold truncate block">{step.shortLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters Bar & Search */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Rechercher par N° Bon, Patient, Labo, Dent (FDI), Teinte..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-outline-variant bg-surface text-xs placeholder:text-outline focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Lab filter */}
          <select
            value={selectedLabFilter}
            onChange={(e) => setSelectedLabFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
          >
            <option value="ALL">Tous les laboratoires ({labs.length})</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs font-semibold focus:ring-2 focus:ring-secondary/40 focus:outline-hidden"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="DELAYED">⚠️ En Retard uniquement</option>
            <option value="PREPARATION">1. En Préparation</option>
            <option value="SENT">2. Envoyé au labo</option>
            <option value="RECEIVED">3. Reçu au cabinet</option>
            <option value="FITTING">4. En essayage</option>
            <option value="DELIVERED">5. Posé / Livré</option>
          </select>

          {(searchTerm || selectedLabFilter !== 'ALL' || selectedStatusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('')
                setSelectedLabFilter('ALL')
                setSelectedStatusFilter('ALL')
              }}
              className="p-2 text-outline hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors cursor-pointer"
              title="Réinitialiser les filtres"
            >
              <span className="material-symbols-outlined text-base">filter_alt_off</span>
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-high/40 border-b border-outline-variant/40 text-on-surface-variant font-semibold">
                <th className="py-3 px-4">N° Bon</th>
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Dent / Acte</th>
                <th className="py-3 px-3 text-center">Teinte</th>
                <th className="py-3 px-4">Laboratoire</th>
                <th className="py-3 px-3">Date Prévue</th>
                <th className="py-3 px-4">Statut & Étape</th>
                <th className="py-3 px-3 text-right">Coût Labo (DA)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl text-outline mb-2">
                      inbox
                    </span>
                    <p className="font-semibold text-sm">Aucune commande de prothèse trouvée</p>
                    <p className="text-xs text-outline mt-1">
                      Créez votre première fiche navette pour suivre la sous-traitance prothétique
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isLate =
                    order.expectedDate &&
                    order.expectedDate < todayStr &&
                    order.status !== 'DELIVERED' &&
                    order.status !== 'REJECTED'

                  const stepCfg =
                    WORKFLOW_STEPS.find((s) => s.status === order.status) || WORKFLOW_STEPS[0]

                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-surface-container-low/60 transition-colors ${
                        isLate ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* Order Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-secondary">
                        <button
                          onClick={() => setPrintingOrder(order)}
                          className="hover:underline flex items-center gap-1 cursor-pointer text-left"
                          title="Voir le bon de travail"
                        >
                          <span className="material-symbols-outlined text-sm">receipt</span>
                          <span>{order.orderNumber}</span>
                        </button>
                      </td>

                      {/* Patient */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-on-surface block">
                          {order.patientName}
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          Envoyé le {order.sentDate ? order.sentDate.slice(0, 10) : '—'}
                        </span>
                      </td>

                      {/* Tooth & Act */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {order.teeth ? (
                            <span className="px-1.5 py-0.5 rounded-md bg-secondary/10 text-secondary font-mono font-bold text-xs shrink-0 border border-secondary/20" title={`Dents: ${order.teeth}`}>
                              {order.teeth}
                            </span>
                          ) : order.toothNumber ? (
                            <span className="w-6 h-6 rounded-md bg-secondary/10 text-secondary font-mono font-bold flex items-center justify-center shrink-0 border border-secondary/20">
                              {order.toothNumber}
                            </span>
                          ) : (
                            <span className="w-6 h-6 rounded-md bg-surface-container text-on-surface-variant font-mono text-[10px] flex items-center justify-center shrink-0">
                              Arc.
                            </span>
                          )}
                          <div className="min-w-0">
                            <span className="font-semibold text-on-surface block truncate max-w-[180px]">
                              {order.actName}
                            </span>
                            <span className="text-[10px] text-outline">{order.nature}</span>
                          </div>
                        </div>
                      </td>

                      {/* Shade (Teinte) */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-amber-100 text-amber-950 font-mono font-black border border-amber-300 shadow-2xs">
                          {order.shade}
                        </span>
                      </td>

                      {/* Laboratory */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-on-surface block">
                          {order.labName}
                        </span>
                        <span className="text-[10px] text-on-surface-variant">Sous-traitant</span>
                      </td>

                      {/* Expected Date & Late alert */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-on-surface block">
                          {order.expectedDate ? order.expectedDate.slice(0, 10) : '—'}
                        </span>
                        {isLate ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            <span className="material-symbols-outlined text-xs">warning</span>
                            En Retard
                          </span>
                        ) : order.expectedDate === todayStr ? (
                          <span className="text-[10px] text-amber-700 font-bold">
                            Aujourd'hui
                          </span>
                        ) : null}
                      </td>

                      {/* Status Stepper Dropdown */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={order.status}
                            onChange={(e) =>
                              handleQuickStatusChange(
                                order.id,
                                e.target.value as ProthesisOrderStatus
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${stepCfg.badgeClass}`}
                          >
                            <option value="PREPARATION">1. Préparation</option>
                            <option value="SENT">2. Envoyé au labo</option>
                            <option value="RECEIVED">3. Reçu du labo</option>
                            <option value="FITTING">4. Essayage bouche</option>
                            <option value="DELIVERED">5. Posé / Livré</option>
                            <option value="REJECTED">Refait / Rejeté</option>
                          </select>
                        </div>
                      </td>

                      {/* Lab Cost DA */}
                      <td className="py-3.5 px-3 text-right">
                        <span className="font-mono font-bold text-on-surface block">
                          {order.labCostDA ? order.labCostDA.toLocaleString() : '0'} DA
                        </span>
                        {order.clinicPriceDA > 0 && (
                          <span className="text-[10px] text-on-surface-variant font-mono">
                            Patient: {order.clinicPriceDA.toLocaleString()} DA
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPrintingOrder(order)}
                            className="p-1.5 rounded-lg text-secondary hover:bg-secondary-fixed/50 transition-colors cursor-pointer"
                            title="Imprimer Bon de Travail Labo"
                          >
                            <span className="material-symbols-outlined text-base">print</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingOrder(order)
                              setShowNewOrderModal(true)
                            }}
                            className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                            title="Modifier"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order.id, order.orderNumber)}
                            className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/30 transition-colors cursor-pointer"
                            title="Supprimer"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New / Edit Order Modal */}
      {showNewOrderModal && (
        <NewProthesisOrderModal
          isOpen={showNewOrderModal}
          onClose={() => {
            setShowNewOrderModal(false)
            setEditingOrder(null)
          }}
          onSuccess={() => loadDashboardData()}
          existingOrder={editingOrder}
        />
      )}

      {/* Printable Lab Slip View Modal */}
      {printingOrder && (
        <PrintableLabSlip
          order={printingOrder}
          patient={patients.find((p) => p.id === printingOrder.patientId)}
          lab={labs.find((l) => l.id === printingOrder.labId)}
          onClose={() => setPrintingOrder(null)}
        />
      )}

      {/* Contracted Labs Management Modal */}
      {showManageLabsModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest text-on-surface w-full max-w-2xl rounded-2xl shadow-2xl border border-outline-variant/60 overflow-hidden flex flex-col my-auto animate-in fade-in duration-150">
            <div className="px-6 py-4 bg-surface-container-high border-b border-outline-variant/60 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-2xl">domain</span>
                <h3 className="font-bold text-base">Mylab — Laboratoires Partenaires Conventionnés</h3>
              </div>
              <button
                onClick={() => setShowManageLabsModal(false)}
                className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Add Lab Form */}
              <form onSubmit={handleAddLab} className="p-4 bg-surface-container rounded-2xl border border-outline-variant/60 space-y-3">
                <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary text-sm">add_business</span>
                  <span>Enregistrer un nouveau laboratoire sous-traitant</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                      Nom du Laboratoire *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Laboratoire Dentaire Prothèse Moderne"
                      value={newLabName}
                      onChange={(e) => setNewLabName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                      Téléphone *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 0550 12 34 56"
                      value={newLabPhone}
                      onChange={(e) => setNewLabPhone(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                      Wilaya
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Alger, Blida, Oran..."
                      value={newLabWilaya}
                      onChange={(e) => setNewLabWilaya(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                      Nom du Prothésiste / Contact
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: M. Karim (Chef de labo)"
                      value={newLabContact}
                      onChange={(e) => setNewLabContact(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs"
                    />
                  </div>
                </div>
                <div className="text-right pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-secondary text-white rounded-xl text-xs font-bold hover:bg-secondary/90 cursor-pointer transition-colors shadow-xs"
                  >
                    Enregistrer le Laboratoire
                  </button>
                </div>
              </form>

              {/* Lab List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-on-surface">
                  Laboratoires Enregistrés ({labs.length})
                </h4>
                <div className="divide-y divide-outline-variant/30 border border-outline-variant/60 rounded-xl overflow-hidden">
                  {labs.map((lab) => (
                    <div
                      key={lab.id}
                      className="p-3 bg-surface hover:bg-surface-container-low flex items-center justify-between transition-colors"
                    >
                      <div>
                        <span className="font-bold text-xs text-on-surface block">{lab.name}</span>
                        <div className="flex items-center gap-3 text-[11px] text-on-surface-variant mt-0.5">
                          <span className="font-mono text-secondary">{lab.phone}</span>
                          <span>•</span>
                          <span>{lab.wilaya || 'Alger'}</span>
                          {lab.contactPerson && (
                            <>
                              <span>•</span>
                              <span>Contact : {lab.contactPerson}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteLab(lab.id, lab.name)}
                        className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/30 transition-colors cursor-pointer"
                        title="Supprimer ce laboratoire"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
