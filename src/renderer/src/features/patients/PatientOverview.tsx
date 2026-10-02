import React, { useState, useEffect } from 'react'
import { Patient, MedicalAntecedentsRecord } from '@shared/types'
import { useNavigation } from '../../context/NavigationContext'
import { useToast } from '../../context/ToastContext'
import { patientService } from '../../services/patientService'
import PatientTimeline from './PatientTimeline'
import DentalChart from '../dentalChart/DentalChart'
import ClinicalNotesTab from '../clinicalNotes/ClinicalNotesTab'
import PrescriptionBuilder from '../prescriptions/PrescriptionBuilder'
import NewVisitModal from './NewVisitModal'
import EditPatientModal from './EditPatientModal'
import PrintablePatientFile from './PrintablePatientFile'
import MedicalHistoryModal from './MedicalHistoryModal'
import PatientProthesisTab from './PatientProthesisTab'
import PatientDevisTab from './PatientDevisTab'
import PatientBilansTab from './PatientBilansTab'
import { evaluateClinicalAlerts } from './medicalAlertUtils'

interface PatientOverviewProps {
  patient: Patient
  onBack: () => void
  onPatientUpdated: () => void
}

type TabType = 'overview' | 'chart' | 'notes' | 'prescriptions' | 'prothesis' | 'devis' | 'bilans'

export default function PatientOverview({
  patient,
  onBack,
  onPatientUpdated
}: PatientOverviewProps): JSX.Element {
  const { currentLocation, setPatientSubTab, goBack, canGoBack, goToTab } = useNavigation()
  const { showToast } = useToast()
  const activeTab: TabType =
    currentLocation.type === 'patient' && currentLocation.patientSubTab
      ? currentLocation.patientSubTab
      : 'overview'
  const [patientData, setPatientData] = useState<Patient>(patient)
  const [medicalHistory, setMedicalHistory] = useState<MedicalAntecedentsRecord | null>(null)
  const [showNewVisitModal, setShowNewVisitModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPrintFileModal, setShowPrintFileModal] = useState(false)
  const [showMedicalHistoryModal, setShowMedicalHistoryModal] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isProcessingAction, setIsProcessingAction] = useState(false)

  const loadMedicalHistory = async (patientId: string): Promise<void> => {
    try {
      const hist = await patientService.getMedicalHistory(patientId)
      setMedicalHistory(hist)
    } catch (err) {
      console.warn('Could not load medical history', err)
    }
  }

  useEffect(() => {
    setPatientData(patient)
    loadMedicalHistory(patient.id)
  }, [patient])

  useEffect(() => {
    const handleOpenPrint = (): void => setShowPrintFileModal(true)
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setShowPrintFileModal(true)
      }
    }
    window.addEventListener('open-patient-print-view', handleOpenPrint)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('open-patient-print-view', handleOpenPrint)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Calculate dynamic exact age
  const calculateAge = (dob?: string): string => {
    if (!dob) return ''
    const birthDate = new Date(dob)
    if (isNaN(birthDate.getTime())) return ''
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return `${Math.max(0, age)} ans`
  }

  const handleArchivePatient = async (): Promise<void> => {
    try {
      setIsProcessingAction(true)
      await patientService.deletePatient(patientData.id)
      showToast(`Dossier de ${patientData.firstName} ${patientData.lastName} archivé avec succès`, 'warning')
      onPatientUpdated()
      goToTab('patients')
    } catch (err: any) {
      showToast(err?.message || "Erreur lors de l'archivage du dossier", 'error')
    } finally {
      setIsProcessingAction(false)
      setShowArchiveConfirm(false)
    }
  }

  const handlePermanentDeletePatient = async (): Promise<void> => {
    try {
      setIsProcessingAction(true)
      await patientService.permanentDeletePatient(patientData.id)
      showToast(`Dossier de ${patientData.firstName} ${patientData.lastName} supprimé définitivement`, 'error')
      onPatientUpdated()
      goToTab('patients')
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la suppression définitive', 'error')
    } finally {
      setIsProcessingAction(false)
      setShowDeleteConfirm(false)
    }
  }

  const clinicalAlerts = evaluateClinicalAlerts(medicalHistory, patientData.medicalAlerts)

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-surface text-on-surface overflow-y-auto">
      {/* 1. Persistent Patient Header (Stitch design matching) */}
      <div className="bg-surface-container-lowest border-b border-outline-variant/60 sticky top-0 z-20 shadow-xs print:static print:border-none print:shadow-none">
        <div className="px-6 py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {/* Identity & Clinical Alerts */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (canGoBack) {
                  goBack()
                } else {
                  onBack()
                }
              }}
              title="Retour à l'écran précédent"
              className="p-2 -ml-2 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer print:hidden"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>

            <div className="w-14 h-14 rounded-2xl bg-secondary-fixed text-secondary flex items-center justify-center font-bold text-xl shadow-xs border border-secondary/20 shrink-0">
              {patientData.firstName?.[0] || 'P'}
              {patientData.lastName?.[0] || ''}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-on-surface">
                  {patientData.firstName} {patientData.lastName}
                </h1>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-surface-container-highest text-secondary border border-outline-variant/40">
                  {patientData.patientNumber}
                </span>
                {patientData.bloodGroup && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-error-container text-error">
                    {patientData.bloodGroup}
                  </span>
                )}
                {medicalHistory?.generalRiskLevel && medicalHistory.generalRiskLevel !== 'LOW' && (
                  <span
                    onClick={() => setShowMedicalHistoryModal(true)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer uppercase ${
                      medicalHistory.generalRiskLevel === 'CRITICAL'
                        ? 'bg-rose-600 text-white animate-pulse'
                        : medicalHistory.generalRiskLevel === 'HIGH'
                        ? 'bg-orange-500 text-white'
                        : 'bg-amber-500 text-white'
                    }`}
                    title="Niveau de risque clinique général"
                  >
                    Risque {medicalHistory.generalRiskLevel}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-on-surface-variant font-medium">
                {patientData.dateOfBirth && (
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">cake</span>
                    {calculateAge(patientData.dateOfBirth)} ({patientData.gender === 'F' ? 'Femme' : 'Homme'})
                  </span>
                )}
                <span className="flex items-center gap-1 font-mono">
                  <span className="material-symbols-outlined text-sm">phone</span>
                  {patientData.phone}
                </span>
                {patientData.wilaya && (
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    {patientData.wilaya}
                  </span>
                )}
                {patientData.cin && (
                  <span className="font-mono text-[11px] text-outline">
                    NIN: {patientData.cin}
                  </span>
                )}
              </div>

              {/* Pulsing Clinical Risk Badges in Patient Header */}
              {clinicalAlerts.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {clinicalAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => setShowMedicalHistoryModal(true)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold shadow-xs transition-transform hover:scale-105 cursor-pointer ${
                        alert.badgeBg
                      } ${alert.isPulsing ? 'animate-pulse' : ''}`}
                      title={`${alert.title} · Cliquez pour ouvrir le bilan médical`}
                    >
                      <span className="material-symbols-outlined text-sm">{alert.icon}</span>
                      <span>{alert.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions & Clinical Alerts */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end print:hidden flex-wrap">
            {clinicalAlerts.length === 0 && (
              <div
                onClick={() => setShowMedicalHistoryModal(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-tertiary-fixed text-on-tertiary-container text-xs font-semibold cursor-pointer hover:opacity-90"
                title="Bilan médical sain - Cliquez pour consulter"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>Bilan Médical Serein</span>
              </div>
            )}

            <button
              onClick={() => setShowMedicalHistoryModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-semibold border border-outline-variant/60 shadow-xs transition-all cursor-pointer"
              title="Consulter et mettre à jour le bilan médical systémique"
            >
              <span className="material-symbols-outlined text-base text-rose-500">health_and_safety</span>
              <span>Bilan Médical</span>
            </button>

            <button
              onClick={() => setShowPrintFileModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-semibold border border-outline-variant/60 shadow-xs transition-all cursor-pointer"
              title="Aperçu avant impression du dossier patient complet (Ctrl+P)"
            >
              <span className="material-symbols-outlined text-base text-secondary">print</span>
              <span>Imprimer</span>
            </button>

            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-semibold border border-outline-variant/60 shadow-xs transition-all cursor-pointer"
              title="Modifier les données du patient"
            >
              <span className="material-symbols-outlined text-base text-secondary">edit</span>
              <span>Modifier</span>
            </button>

            <button
              onClick={() => setShowArchiveConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-semibold border border-amber-200/80 shadow-xs transition-all cursor-pointer"
              title="Archiver le dossier patient (Soft Delete)"
            >
              <span className="material-symbols-outlined text-base text-amber-700">archive</span>
              <span>Archiver</span>
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-900 rounded-xl text-xs font-semibold border border-rose-200/80 shadow-xs transition-all cursor-pointer"
              title="Supprimer définitivement le dossier (Action irréversible)"
            >
              <span className="material-symbols-outlined text-base text-rose-600">delete_forever</span>
              <span>Supprimer</span>
            </button>

            <button
              onClick={() => setShowNewVisitModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>+ Nouvelle Visite</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 flex gap-2 border-t border-outline-variant/40 bg-surface overflow-x-auto print:hidden">
          {[
            { id: 'overview', label: 'Vue d’ensemble & Historique', icon: 'timeline' },
            { id: 'chart', label: 'Schéma Dentaire (FDI)', icon: 'dentistry' },
            { id: 'notes', label: 'Notes Cliniques', icon: 'description' },
            { id: 'prescriptions', label: 'Ordonnances', icon: 'prescriptions' },
            { id: 'prothesis', label: 'Prothèses & Labo', icon: 'precision_manufacturing' },
            { id: 'devis', label: 'Devis & Plans', icon: 'request_quote' },
            { id: 'bilans', label: 'Bilans & Radios', icon: 'biotech' }
          ].map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setPatientSubTab(tab.id as TabType)}
                className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-secondary text-secondary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-base">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Active Tab Content Canvas */}
      <div className="p-6 max-w-7xl mx-auto w-full">
        {activeTab === 'overview' && (
          <PatientTimeline
            patient={patientData}
            onOpenNewVisit={() => setShowNewVisitModal(true)}
            onOpenDentalChart={() => setPatientSubTab('chart')}
            onOpenPrescriptions={() => setPatientSubTab('prescriptions')}
          />
        )}

        {activeTab === 'chart' && (
          <DentalChart
            patientId={patientData.id}
            patientBirthDate={patientData.dateOfBirth}
            onTreatmentAdded={onPatientUpdated}
          />
        )}

        {activeTab === 'notes' && (
          <ClinicalNotesTab
            patientId={patientData.id}
            practitionerName="Dr. Amrani"
          />
        )}

        {activeTab === 'prescriptions' && (
          <PrescriptionBuilder
            patient={patientData}
            dentistName="Dr. Amrani"
            onPrescriptionUpdated={onPatientUpdated}
          />
        )}

        {activeTab === 'prothesis' && (
          <PatientProthesisTab
            patient={patientData}
          />
        )}

        {activeTab === 'devis' && (
          <PatientDevisTab
            patient={patientData}
            onTreatmentsCreated={onPatientUpdated}
          />
        )}

        {activeTab === 'bilans' && (
          <PatientBilansTab
            patient={patientData}
            onAlertTriggered={onPatientUpdated}
          />
        )}
      </div>

      {/* New Visit Modal Drawer */}
      {showNewVisitModal && (
        <NewVisitModal
          patient={patientData}
          onClose={() => setShowNewVisitModal(false)}
          onSuccess={() => {
            onPatientUpdated()
          }}
        />
      )}

      {/* Edit Patient Modal */}
      {showEditModal && (
        <EditPatientModal
          isOpen={showEditModal}
          patient={patientData}
          onClose={() => setShowEditModal(false)}
          onSuccess={(updated) => {
            setPatientData(updated)
            onPatientUpdated()
          }}
        />
      )}

      {/* Printable Patient File Modal */}
      {showPrintFileModal && (
        <PrintablePatientFile
          patient={patientData}
          onClose={() => setShowPrintFileModal(false)}
        />
      )}

      {/* Medical History & Systemic Questionnaire Modal */}
      {showMedicalHistoryModal && (
        <MedicalHistoryModal
          patient={patientData}
          onClose={() => setShowMedicalHistoryModal(false)}
          onSuccess={() => {
            loadMedicalHistory(patientData.id)
            onPatientUpdated()
          }}
        />
      )}

      {/* Modal Confirmation Archivage */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">archive</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-on-surface">Archiver le Dossier Médical</h3>
                <p className="text-xs text-on-surface-variant font-mono">{patientData.patientNumber}</p>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Confirmez-vous l'archivage du dossier de <strong className="text-on-surface font-semibold">{patientData.firstName} {patientData.lastName}</strong> ?
              Le dossier sera masqué des listes actives, mais son historique clinique et comptable restera conservé.
            </p>
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-outline-variant/40">
              <button
                type="button"
                onClick={() => setShowArchiveConfirm(false)}
                disabled={isProcessingAction}
                className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleArchivePatient}
                disabled={isProcessingAction}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isProcessingAction ? 'Archivage...' : "Confirmer l'archivage"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation Suppression Définitive */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-3xl border border-rose-300 shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">delete_forever</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-rose-700">Suppression Définitive</h3>
                <p className="text-xs text-on-surface-variant font-mono">{patientData.patientNumber}</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-medium space-y-1">
              <p className="font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">warning</span>
                Attention : Action Irréversible !
              </p>
              <p>
                Vous êtes sur le point d'effacer définitivement le dossier de <strong className="text-rose-950">{patientData.firstName} {patientData.lastName}</strong>.
                L'ensemble de ses rendez-vous, soins dentaires, ordonnances et bilans seront définitivement purgés de la base locale.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-outline-variant/40">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isProcessingAction}
                className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handlePermanentDeletePatient}
                disabled={isProcessingAction}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isProcessingAction ? 'Suppression...' : 'Oui, Supprimer Définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
