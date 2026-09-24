import React, { useState, useEffect } from 'react'
import { Patient, MedicalAntecedentsRecord } from '@shared/types'
import { useNavigation } from '../../context/NavigationContext'
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
  const { currentLocation, setPatientSubTab, goBack, canGoBack } = useNavigation()
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
    window.addEventListener('open-patient-print-view', handleOpenPrint)
    return () => window.removeEventListener('open-patient-print-view', handleOpenPrint)
  }, [])

  // Calculate age
  const calculateAge = (dob?: string): string => {
    if (!dob) return ''
    const birthYear = new Date(dob).getFullYear()
    const currentYear = new Date().getFullYear()
    return `${currentYear - birthYear} ans`
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
              title="Aperçu avant impression du dossier patient complet"
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
    </div>
  )
}
