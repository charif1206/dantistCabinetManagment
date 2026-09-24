import React, { useEffect, useState } from 'react'
import { Patient, Appointment, MachineAccountState, DashboardStats } from '@shared/types'
import { patientService } from './services/patientService'
import { appointmentService } from './services/appointmentService'
import { dashboardService } from './services/dashboardService'
import { backupService } from './services/backupService'
import { useAuth } from './context/AuthContext'
import { useToast } from './context/ToastContext'
import { useNavigation } from './context/NavigationContext'
import ToastContainer from './features/common/ToastContainer'
import Breadcrumbs from './features/common/Breadcrumbs'
import { validateAlgerianPhone, validateRequiredField } from './utils/validators'
import {
  canTransitionTo,
  getAllowedTransitions,
  STATUS_CONFIG
} from './utils/appointmentTransitions'
import LoginView from './features/auth/LoginView'
import PatientOverview from './features/patients/PatientOverview'
import NewPatientModal from './features/patients/NewPatientModal'
import FullCalendarView from './features/planning/FullCalendarView'
import InvoiceListView from './features/billing/InvoiceListView'
import DebtsManager from './features/billing/DebtsManager'
import ProthesisDashboard from './features/prothesis/ProthesisDashboard'
import { ClinicalAnalyticsView } from './features/analytics/ClinicalAnalyticsView'
import WaitingRoomWidget from './features/waitingRoom/WaitingRoomWidget'
import { waitingRoomService } from './services/waitingRoomService'

export default function App(): JSX.Element {
  const { currentUser, isAuthenticated, logout } = useAuth()
  const { showToast } = useToast()
  const {
    currentLocation,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    goToTab,
    openPatient,
    updateCurrentPatient
  } = useNavigation()

  const activeTab = currentLocation.tab
  const selectedPatient = currentLocation.type === 'patient' ? currentLocation.patient || null : null

  // State loaded via Frontend Service Layer
  const [machineState, setMachineState] = useState<MachineAccountState | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    todayAppointmentsCount: 0,
    waitingPatientsCount: 0,
    completedTreatmentsCount: 0,
    totalPatientsCount: 0,
    todayRevenueDA: 0,
    totalDebtsDA: 0,
    pendingSyncCount: 0
  })
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [waitingRoomCount, setWaitingRoomCount] = useState<number>(0)
  const [waitingUrgentCount, setWaitingUrgentCount] = useState<number>(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [backupMessage, setBackupMessage] = useState<{ text: string; isError?: boolean } | null>(null)
  const [showAddPatientModal, setShowAddPatientModal] = useState(false)

  // Load initial data via Service Layer
  const loadData = async (): Promise<void> => {
    try {
      const [mState, dStats, apts, pats, queue] = await Promise.all([
        dashboardService.getMachineState(),
        dashboardService.getStats(),
        appointmentService.getAppointments(),
        patientService.getPatients(),
        waitingRoomService.getWaitingQueue()
      ])
      setMachineState(mState)
      setStats(dStats)
      setAppointments(apts)
      setPatients(pats)

      const activeWaiting = queue.filter((e) => e.status === 'WAITING').length
      const urgents = queue.filter((e) => Boolean(e.isUrgent) && e.status === 'WAITING').length
      setWaitingRoomCount(activeWaiting)
      setWaitingUrgentCount(urgents)

      // If viewing a patient, keep the patient data in sync
      if (selectedPatient) {
        const refreshed = pats.find((p) => p.id === selectedPatient.id)
        if (refreshed) updateCurrentPatient(refreshed)
      }
    } catch (err) {
      console.error('Error loading clinical data through service layer:', err)
    }
  }

  useEffect(() => {
    loadData()

    // Subscribe to sync state changes via Service Layer
    const unsubscribe = dashboardService.subscribeToSyncState((updatedState) => {
      setMachineState(updatedState)
      dashboardService.getStats().then(setStats)
    })
    return () => unsubscribe()
  }, [])

  // Expose showToast globally for dev tools / verification
  useEffect(() => {
    ;(window as any).showToast = showToast
  }, [showToast])

  // Intercept Ctrl+P to open the in-app Print View modal instead of raw Windows print dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        if (selectedPatient) {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('open-patient-print-view'))
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedPatient])

  // Filter patients by Algerian search terms (name, phone, patientNumber, CIN)
  const filteredPatients = patients.filter(
    (p) =>
      p.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone.includes(searchTerm) ||
      p.patientNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.cin && p.cin.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Trigger manual cloud sync
  const handleTriggerSync = async (): Promise<void> => {
    setIsSyncing(true)
    try {
      await dashboardService.triggerSync()
      await loadData()
      showToast('Synchronisation cloud effectuée avec succès', 'info')
    } catch (err: any) {
      showToast(`Échec de la synchronisation: ${err?.message || 'Erreur'}`, 'error')
    } finally {
      setTimeout(() => setIsSyncing(false), 600)
    }
  }

  // Trigger atomic SQLite backup & integrity check
  const handleTriggerBackup = async (): Promise<void> => {
    setIsBackingUp(true)
    setBackupMessage(null)
    try {
      const res = await backupService.createBackup()
      if (res.success) {
        const sizeKb = Math.round(res.sizeBytes / 1024)
        const msg = `Sauvegarde SQLite réussie (${sizeKb} Ko) · Intégrité vérifiée`
        showToast(msg, 'success')
        setBackupMessage({ text: msg })
      } else {
        const errMsg = `Erreur sauvegarde: ${res.error}`
        showToast(errMsg, 'error')
        setBackupMessage({
          text: errMsg,
          isError: true
        })
      }
    } catch (e: any) {
      const errMsg = `Erreur: ${e?.message}`
      showToast(errMsg, 'error')
      setBackupMessage({ text: errMsg, isError: true })
    } finally {
      setIsBackingUp(false)
      setTimeout(() => setBackupMessage(null), 5000)
    }
  }

  // Update appointment status (triggers SQLite update + sync queue)
  const handleStatusChange = async (aptId: string, newStatus: Appointment['status']): Promise<void> => {
    const apt = appointments.find((a) => a.id === aptId)
    if (apt && !canTransitionTo(apt.status, newStatus)) {
      showToast(`Transition non autorisée depuis le statut ${STATUS_CONFIG[apt.status]?.label || apt.status}`, 'error')
      return
    }
    await appointmentService.updateStatus(aptId, newStatus)
    await loadData()
    showToast(`Statut mis à jour : ${STATUS_CONFIG[newStatus]?.label || newStatus}`, 'info')
  }

  // Soft delete patient
  const handleDeletePatient = async (id: string, name: string): Promise<void> => {
    if (confirm(`Confirmez-vous l'archivage du dossier de ${name} ?`)) {
      await patientService.deletePatient(id)
      if (selectedPatient?.id === id) {
        goToTab('patients')
      }
      await loadData()
      showToast(`Dossier de ${name} archivé`, 'warning')
    }
  }

  // Session guard
  if (!isAuthenticated) {
    return (
      <>
        <ToastContainer />
        <LoginView />
      </>
    )
  }

  return (
    <>
      <ToastContainer />
      <div className="flex h-screen w-full bg-surface text-on-surface overflow-hidden">
      {/* 1. Left Sidebar Navigation (Pure Tailwind matching Stitch style) */}
      <aside className="w-64 border-r border-outline-variant bg-surface-container-low flex flex-col justify-between p-4 shrink-0 select-none print:hidden">
        <div>
          {/* Logo Header with Algerian Clinic Branding */}
          <div className="flex items-center gap-3 px-3 py-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary-container text-primary-fixed flex items-center justify-center font-bold text-xl shadow-xs">
              <span className="material-symbols-outlined text-2xl text-secondary-container">dentistry</span>
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-on-surface">DentaFlow</h1>
              <span className="text-xs text-on-surface-variant font-medium">Cabinet Dentaire DZ</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => goToTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'dashboard' && !selectedPatient
                  ? 'bg-secondary text-on-secondary shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-xl">dashboard</span>
              <span>Tableau de Bord</span>
            </button>

            <button
              onClick={() => goToTab('patients')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                (activeTab === 'patients' && !selectedPatient) || selectedPatient
                  ? 'bg-secondary text-on-secondary shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-xl">person_search</span>
              <span>Fiches Patients</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-semibold">
                {patients.length}
              </span>
            </button>

            <button
              onClick={() => goToTab('appointments')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'appointments' && !selectedPatient
                  ? 'bg-secondary text-on-secondary shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-xl">calendar_month</span>
              <span>Planning & Fauteuil</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-semibold">
                {appointments.length}
              </span>
            </button>

            <button
              onClick={() => goToTab('billing')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'billing' && !selectedPatient
                  ? 'bg-secondary text-on-secondary shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-xl">payments</span>
              <span>Facturation & Caisse</span>
            </button>

            <button
              onClick={() => goToTab('debts')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'debts' && !selectedPatient
                  ? 'bg-secondary text-on-secondary shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
              <span>Créances & Dettes</span>
              {stats.totalDebtsDA > 0 && (
                <span className="ml-auto text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-bold">
                  Dettes
                </span>
              )}
            </button>

            <button
              onClick={() => goToTab('prothesis')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'prothesis' && !selectedPatient
                  ? 'bg-secondary text-on-secondary shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-xl">precision_manufacturing</span>
              <span>Prothèses & Labo</span>
            </button>

            <button
              onClick={() => goToTab('analytics')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'analytics' && !selectedPatient
                  ? 'bg-secondary text-on-secondary shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-xl">query_stats</span>
              <span>Statistiques & Analyses</span>
            </button>
          </nav>
        </div>

        {/* Machine Account & Cloud Sync Status Badge + Backup Button */}
        <div className="space-y-3">
          {/* Backup notification */}
          {backupMessage && (
            <div
              className={`p-2.5 rounded-xl text-xs font-medium border flex items-center gap-2 animate-in fade-in duration-200 ${
                backupMessage.isError
                  ? 'bg-error-container text-error border-error/30'
                  : 'bg-tertiary-fixed text-on-tertiary-container border-tertiary-fixed-dim'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {backupMessage.isError ? 'error' : 'check_circle'}
              </span>
              <span className="truncate">{backupMessage.text}</span>
            </div>
          )}

          <div className="bg-surface-container rounded-2xl p-3.5 border border-outline-variant/60 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary-fixed-dim opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-on-tertiary-container"></span>
                </span>
                <span className="text-xs font-semibold text-on-surface">Machine Account</span>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant">
                Zero-UI
              </span>
            </div>

            <div className="text-[11px] text-on-surface-variant font-mono truncate" title={machineState?.machineId}>
              Poste: {machineState?.machineId || 'Initialisation...'}
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-outline-variant/40">
              <span className="text-on-surface-variant text-[11px]">Sync Cloud (Mock):</span>
              <span className="inline-flex items-center gap-1 font-medium text-[11px] text-on-tertiary-container">
                <span className="material-symbols-outlined text-sm">cloud_done</span>
                Prêt
              </span>
            </div>

            {stats.pendingSyncCount > 0 && (
              <div className="text-[11px] text-error font-medium flex items-center justify-between">
                <span>File de synchronisation:</span>
                <span className="px-1.5 py-0.2 rounded-full bg-error-container text-error text-[10px] font-bold">
                  {stats.pendingSyncCount}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                onClick={handleTriggerSync}
                disabled={isSyncing}
                title="Synchroniser avec le Cloud"
                className="py-1.5 px-2 rounded-lg bg-surface-container-highest hover:bg-outline-variant/50 text-on-surface text-[11px] font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <span className={`material-symbols-outlined text-xs ${isSyncing ? 'animate-spin' : ''}`}>
                  sync
                </span>
                <span>{isSyncing ? 'Sync...' : 'Sync'}</span>
              </button>

              <button
                onClick={handleTriggerBackup}
                disabled={isBackingUp}
                title="Créer une sauvegarde locale SQLite immédiate"
                className="py-1.5 px-2 rounded-lg bg-primary-container text-on-primary hover:bg-on-secondary-fixed-variant text-[11px] font-bold flex items-center justify-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <span className={`material-symbols-outlined text-xs ${isBackingUp ? 'animate-spin' : ''}`}>
                  save
                </span>
                <span>{isBackingUp ? 'Copie...' : 'Backup'}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Main Clinical Workspace */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar with Navigation Controls & Breadcrumbs */}
        <header className="h-16 px-6 border-b border-outline-variant/60 flex items-center justify-between bg-surface-container-lowest/80 backdrop-blur sticky top-0 z-10 shrink-0 print:hidden">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Quick Navigation Buttons (LIFO Stack) */}
            <div className="flex items-center gap-1 shrink-0 bg-surface-container/70 p-1 rounded-xl border border-outline-variant/40 shadow-xs">
              <button
                type="button"
                onClick={goBack}
                disabled={!canGoBack}
                title={canGoBack ? 'Page précédente (Retour)' : 'Aucun historique précédent'}
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center"
                aria-label="Page précédente"
              >
                <span className="material-symbols-outlined text-lg leading-none">arrow_back</span>
              </button>
              <button
                type="button"
                onClick={goForward}
                disabled={!canGoForward}
                title={canGoForward ? 'Page suivante (Avancer)' : 'Aucun historique suivant'}
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center"
                aria-label="Page suivante"
              >
                <span className="material-symbols-outlined text-lg leading-none">arrow_forward</span>
              </button>
            </div>

            {/* Interactive Breadcrumbs */}
            <div className="hidden sm:block border-l border-outline-variant/50 pl-3.5">
              <Breadcrumbs />
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-on-surface">{currentUser?.fullName || 'Utilisateur'}</div>
              <div className="text-[10px] text-secondary font-medium">
                {currentUser?.role === 'DENTIST'
                  ? 'Chirurgien-Dentiste'
                  : currentUser?.role === 'ADMIN'
                  ? 'Administrateur'
                  : 'Assistant(e)'}
              </div>
            </div>
            <button
              onClick={() => setShowAddPatientModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-sm font-semibold shadow-xs transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              <span>Nouveau Patient</span>
            </button>
            <button
              onClick={logout}
              title="Déconnexion de la session"
              className="p-2 rounded-xl hover:bg-error-container/30 text-outline hover:text-error transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </header>

        {/* Content View: Patient Overview or Active Tab */}
        {selectedPatient ? (
          <PatientOverview
            patient={selectedPatient}
            onBack={() => {
              goBack()
              loadData()
            }}
            onPatientUpdated={loadData}
          />
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === 'appointments' && <FullCalendarView />}

            {activeTab === 'billing' && <InvoiceListView />}

            {activeTab === 'debts' && <DebtsManager />}

            {activeTab === 'prothesis' && <ProthesisDashboard />}

            {activeTab === 'analytics' && <ClinicalAnalyticsView />}

            {(activeTab === 'dashboard' || activeTab === 'patients') && (
              <>
                {/* Key Metric KPI Cards (with Algerian Dinars - DA) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Today's Total Appointments */}
                  <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-xs flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-on-surface-variant">Rendez-vous Aujourd'hui</p>
                      <p className="text-2xl font-bold text-on-surface mt-1">{stats.todayAppointmentsCount}</p>
                      <span className="text-[11px] text-secondary font-medium">
                        Planning de la journée
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-2xl">event_available</span>
                    </div>
                  </div>

                  {/* Card 2: In Waiting Room */}
                  <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-xs flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-on-surface-variant">En Salle d'Attente</p>
                      <p className="text-2xl font-black text-amber-800 mt-1">{waitingRoomCount}</p>
                      <span className="text-[11px] text-amber-700 font-semibold">
                        {waitingUrgentCount > 0 ? `⚠️ ${waitingUrgentCount} cas urgent(s)` : 'Patients présents au cabinet'}
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-900">
                      <span className="material-symbols-outlined text-2xl">airline_seat_recline_normal</span>
                    </div>
                  </div>

                  {/* Card 3: Remaining to Visit */}
                  <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-xs flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-on-surface-variant">Reste à Visiter</p>
                      <p className="text-2xl font-black text-secondary mt-1">
                        {appointments.filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED' || a.status === 'IN_CHAIR').length + waitingRoomCount}
                      </p>
                      <span className="text-[11px] text-on-surface-variant font-medium">Fauteuil & RDV restants</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-secondary-fixed/50 flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined text-2xl">pending_actions</span>
                    </div>
                  </div>

                  {/* Card 4: Today's Revenue DA */}
                  <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/60 shadow-xs flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-on-surface-variant">Recettes du Jour (DA)</p>
                      <p className="text-2xl font-bold text-on-tertiary-container mt-1">
                        {stats.todayRevenueDA.toLocaleString()} <span className="text-sm font-semibold">DA</span>
                      </p>
                      <span className="text-[11px] text-on-surface-variant">Encaissements caisse</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-tertiary-container/10 flex items-center justify-center text-on-tertiary-container">
                      <span className="material-symbols-outlined text-2xl">payments</span>
                    </div>
                  </div>
                </div>

                {/* Section: Live Waiting Room Queue (Salle d'Attente en Direct) */}
                {activeTab === 'dashboard' && (
                  <WaitingRoomWidget onQueueUpdated={loadData} />
                )}

                {/* Section: Today's Appointments & Chair Status (Dashboard view) */}
                {activeTab === 'dashboard' && (
                  <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary">airline_seat_recline_extra</span>
                        <h3 className="font-bold text-base text-on-surface">Patients & Fauteuil du Jour</h3>
                      </div>
                      <button
                        onClick={() => goToTab('appointments')}
                        className="text-xs font-semibold text-secondary hover:underline cursor-pointer"
                      >
                        Voir tout le calendrier →
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-outline-variant/40 text-xs text-on-surface-variant font-medium">
                            <th className="py-2.5 px-3">Heure</th>
                            <th className="py-2.5 px-3">Patient</th>
                            <th className="py-2.5 px-3">Téléphone</th>
                            <th className="py-2.5 px-3">Type de Soin</th>
                            <th className="py-2.5 px-3">Statut</th>
                            <th className="py-2.5 px-3 text-right">Actions Fauteuil</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/30">
                          {appointments.slice(0, 5).map((apt) => (
                            <tr key={apt.id} className="hover:bg-surface-container-low/60 transition-colors">
                              <td className="py-3 px-3 font-mono font-medium text-xs text-on-surface">
                                {apt.dateTime.split('T')[1]?.slice(0, 5) || '09:00'}
                              </td>
                              <td className="py-3 px-3 font-semibold text-on-surface">{apt.patientName}</td>
                              <td className="py-3 px-3 text-on-surface-variant font-mono text-xs">
                                {apt.patientPhone || '—'}
                              </td>
                              <td className="py-3 px-3 text-on-surface-variant">{apt.treatmentType}</td>
                              <td className="py-3 px-3">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    apt.status === 'IN_CHAIR'
                                      ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                      : apt.status === 'COMPLETED'
                                      ? 'bg-tertiary-fixed text-on-tertiary-container'
                                      : 'bg-surface-container-high text-on-surface'
                                  }`}
                                >
                                  {apt.status === 'IN_CHAIR' && 'Au Fauteuil'}
                                  {apt.status === 'COMPLETED' && 'Terminé'}
                                  {apt.status === 'SCHEDULED' && 'Programmé'}
                                  {apt.status === 'CONFIRMED' && 'Confirmé'}
                                  {apt.status === 'CANCELLED' && 'Annulé'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {getAllowedTransitions(apt.status).map((targetStatus) => {
                                    const cfg = STATUS_CONFIG[targetStatus]
                                    return (
                                      <button
                                        key={targetStatus}
                                        onClick={() => handleStatusChange(apt.id, targetStatus)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${cfg.colorClass}`}
                                      >
                                        {cfg.label}
                                      </button>
                                    )
                                  })}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Section: Patients List & Search */}
                <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary">recent_patient</span>
                      <h3 className="font-bold text-base text-on-surface">Dossiers Médicaux Patients (Algérie)</h3>
                    </div>

                    {/* Search Input (Pure Tailwind) */}
                    <div className="relative w-full sm:w-80">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg">
                        search
                      </span>
                      <input
                        type="text"
                        placeholder="Rechercher nom, N° dossier, tél, CNI..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-sm placeholder:text-outline focus:outline-hidden focus:ring-2 focus:ring-secondary/40 focus:border-secondary transition-all"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-outline-variant/40 text-xs text-on-surface-variant font-medium">
                          <th className="py-2.5 px-3">N° Dossier</th>
                          <th className="py-2.5 px-3">Patient</th>
                          <th className="py-2.5 px-3">Téléphone</th>
                          <th className="py-2.5 px-3">Wilaya</th>
                          <th className="py-2.5 px-3">Antécédents / Alertes</th>
                          <th className="py-2.5 px-3">Groupe</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/30">
                        {filteredPatients.map((p) => (
                          <tr key={p.id} className="hover:bg-surface-container-low/60 transition-colors">
                            <td className="py-3 px-3 font-mono font-semibold text-xs text-secondary">
                              {p.patientNumber}
                            </td>
                            <td className="py-3 px-3">
                              <button
                                onClick={() => openPatient(p, 'overview')}
                                className="font-semibold text-on-surface hover:text-secondary text-left transition-colors cursor-pointer"
                              >
                                {p.lastName.toUpperCase()} {p.firstName}
                              </button>
                              <div className="text-xs text-on-surface-variant">{p.email || 'Sans email'}</div>
                            </td>
                            <td className="py-3 px-3 text-on-surface font-mono text-xs">{p.phone}</td>
                            <td className="py-3 px-3 text-xs text-on-surface">{p.wilaya || 'Alger'}</td>
                            <td className="py-3 px-3">
                              {p.medicalAlerts ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-error-container text-error text-xs font-medium">
                                  <span className="material-symbols-outlined text-xs">warning</span>
                                  {p.medicalAlerts}
                                </span>
                              ) : (
                                <span className="text-xs text-on-surface-variant">Aucune alerte</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-medium text-xs text-on-surface">{p.bloodGroup || '—'}</td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => openPatient(p, 'overview')}
                                  className="px-2.5 py-1 rounded-lg bg-secondary-fixed/50 hover:bg-secondary-fixed text-secondary text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Ouvrir le dossier médical complet"
                                >
                                  <span className="material-symbols-outlined text-sm">folder_open</span>
                                  <span>Dossier</span>
                                </button>
                                <button
                                  onClick={() => handleDeletePatient(p.id, `${p.firstName} ${p.lastName}`)}
                                  title="Archiver le dossier (Soft Delete)"
                                  className="p-1 rounded-lg hover:bg-error-container/30 text-outline hover:text-error transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-base">archive</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* 3. New Patient Modal (Algerian Form - Pure Tailwind & Full Validation) */}
      <NewPatientModal
        isOpen={showAddPatientModal}
        onClose={() => setShowAddPatientModal(false)}
        onSuccess={() => loadData()}
        existingPatients={patients}
      />
    </div>
    </>
  )
}
