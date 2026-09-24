import React, { useState, useEffect } from 'react'
import { Patient, Treatment, ClinicalNote, Prescription, Invoice, MedicalAntecedentsRecord } from '@shared/types'
import { clinicalService } from '../../services/clinicalService'
import { billingService } from '../../services/billingService'
import { patientService } from '../../services/patientService'
import { evaluateClinicalAlerts } from './medicalAlertUtils'

import { printService } from '../../services/printService'
import { useToast } from '../../context/ToastContext'

interface PrintablePatientFileProps {
  patient: Patient
  onClose: () => void
}

export default function PrintablePatientFile({
  patient,
  onClose
}: PrintablePatientFileProps): JSX.Element {
  const { showToast } = useToast()
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [notes, setNotes] = useState<ClinicalNote[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [medicalHistory, setMedicalHistory] = useState<MedicalAntecedentsRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        const [trts, nts, prs, invs, hist] = await Promise.all([
          clinicalService.getTreatments(patient.id),
          clinicalService.getClinicalNotes(patient.id),
          clinicalService.getPrescriptions(patient.id),
          billingService.getInvoices(patient.id),
          patientService.getMedicalHistory(patient.id)
        ])
        setTreatments(trts || [])
        setNotes(nts || [])
        setPrescriptions(prs || [])
        setInvoices(invs || [])
        setMedicalHistory(hist)
      } catch (err) {
        console.error('Failed to load patient records for print view:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [patient.id])

  const calculateAge = (dob?: string): string => {
    if (!dob) return ''
    const birthYear = new Date(dob).getFullYear()
    const currentYear = new Date().getFullYear()
    return `${currentYear - birthYear} ans`
  }

  const totalActsDA = treatments.reduce((acc, t) => acc + (t.price || 0), 0)
  const totalPaidDA = invoices.reduce((acc, i) => acc + (i.paidAmount || 0), 0)
  const remainingDebtDA = Math.max(0, totalActsDA - totalPaidDA)

  const handlePrint = async (): Promise<void> => {
    await printService.printDocument({ printBackground: true })
  }

  const handleExportPDF = async (): Promise<void> => {
    setIsExporting(true)
    try {
      const res = await printService.exportToPDF({
        title: `Dossier_${patient.firstName}_${patient.lastName}`,
        pageSize: 'A4'
      })
      if (res.success && res.filePath) {
        showToast(`PDF enregistré avec succès : ${res.filePath}`, 'success')
      }
    } catch (err: any) {
      showToast(`Erreur export PDF : ${err?.message || 'Erreur'}`, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-white text-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col my-auto print:my-0 print:border-none print:shadow-none print:max-w-none print:rounded-none">
        {/* Screen Toolbar (hidden in print) */}
        <div className="px-6 py-3.5 bg-slate-100 border-b border-slate-200 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="material-symbols-outlined text-secondary">print</span>
            <span className="font-bold text-sm">
              Aperçu avant Impression — Dossier Médical Patient (Format A4)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isLoading || isExporting}
              className="px-3 py-2 bg-surface hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Enregistrer une copie PDF"
            >
              <span className="material-symbols-outlined text-base text-rose-600">picture_as_pdf</span>
              <span>{isExporting ? 'Export...' : 'Exporter PDF'}</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={isLoading}
              className="px-4 py-2 bg-secondary hover:bg-secondary/90 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Lancer l'impression papier"
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

        {/* Printable Sheet */}
        <div
          id="printable-patient-file"
          className="p-8 sm:p-12 space-y-6 bg-white min-h-[700px] flex flex-col justify-between"
        >
          {/* Clinic Header */}
          <div className="border-b-2 border-slate-800 pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                Dr. Mohamed Amrani
              </h1>
              <p className="text-xs font-bold text-secondary uppercase tracking-wider mt-0.5">
                Chirurgien-Dentiste · Spécialiste en Soins & Prothèses Dentaires
              </p>
              <p className="text-[11px] text-slate-600 mt-1">
                Cabinet Médico-Chirurgical Dentaire · Alger, Algérie
              </p>
              <p className="text-[11px] text-slate-600">
                Tél : <span className="font-semibold">0550 12 34 56</span> /{' '}
                <span className="font-semibold">021 65 43 21</span>
              </p>
            </div>

            <div className="text-right">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl ml-auto mb-1">
                <span className="material-symbols-outlined text-2xl">dentistry</span>
              </div>
              <span className="text-xs font-bold text-slate-800 block">Dossier Patient Clinique</span>
              <span className="text-[10px] text-slate-500 font-mono">
                Date : {new Date().toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>

          {/* Patient Identity Block */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Nom & Prénom</span>
                <p className="text-base font-extrabold text-slate-900">
                  {patient.firstName} {patient.lastName}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                  N° {patient.patientNumber}
                </span>
                {patient.bloodGroup && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                    Groupe : {patient.bloodGroup}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">Téléphone</span>
                <span className="font-mono font-bold text-slate-800">{patient.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">Date de Naissance</span>
                <span className="text-slate-800 font-medium">
                  {patient.dateOfBirth || '—'} {patient.dateOfBirth && `(${calculateAge(patient.dateOfBirth)})`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">Genre / Wilaya</span>
                <span className="text-slate-800 font-medium">
                  {patient.gender === 'F' ? 'Femme' : 'Homme'} · {patient.wilaya || 'Alger'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">N° CIN / NIN</span>
                <span className="font-mono text-slate-800">{patient.cin || '—'}</span>
              </div>
            </div>

            {/* Medical Alerts Banner & Questionnaire Summary */}
            {(() => {
              const alerts = evaluateClinicalAlerts(medicalHistory, patient.medicalAlerts)
              return (
                <div className="space-y-2">
                  {alerts.length > 0 ? (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex flex-wrap items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-rose-600">warning</span>
                      <span className="uppercase">Alertes Sécurité Clinique :</span>
                      {alerts.map((a) => (
                        <span
                          key={a.id}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white"
                        >
                          {a.title}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
                      <span>Aucune allergie ou contre-indication médicale majeure signalée.</span>
                    </div>
                  )}

                  {/* Complete Systemic Medical History Questionnaire Breakdown */}
                  {medicalHistory && (
                    <div className="border border-slate-300 rounded-lg p-3 bg-white space-y-2 text-[11px]">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                        <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                          Bilan Médical Systémique & Antécédents par Appareils
                        </span>
                        <span className="font-bold px-2 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700">
                          Niveau de Risque : {medicalHistory.generalRiskLevel}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                        <div>
                          <strong className="text-slate-700">1. Cardio :</strong>{' '}
                          <span className={medicalHistory.cardioChecklist?.length ? 'text-rose-700 font-semibold' : 'text-slate-500'}>
                            {medicalHistory.cardioChecklist?.length ? medicalHistory.cardioChecklist.join(', ') : 'R.A.S (Sain)'}
                          </span>
                        </div>

                        <div>
                          <strong className="text-slate-700">2. Hématologie :</strong>{' '}
                          <span className={medicalHistory.hematologyChecklist?.length ? 'text-red-700 font-bold' : 'text-slate-500'}>
                            {medicalHistory.hematologyChecklist?.length ? medicalHistory.hematologyChecklist.join(', ') : 'R.A.S (Normale)'}
                          </span>
                        </div>

                        <div>
                          <strong className="text-slate-700">3. Digestif/Foie :</strong>{' '}
                          <span className={medicalHistory.gastroChecklist?.length ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
                            {medicalHistory.gastroChecklist?.length ? medicalHistory.gastroChecklist.join(', ') : 'R.A.S'}
                          </span>
                        </div>

                        <div>
                          <strong className="text-slate-700">4. Respiratoire :</strong>{' '}
                          <span className={medicalHistory.respiratoryChecklist?.length ? 'text-cyan-800 font-semibold' : 'text-slate-500'}>
                            {medicalHistory.respiratoryChecklist?.length ? medicalHistory.respiratoryChecklist.join(', ') : 'R.A.S'}
                          </span>
                        </div>

                        <div>
                          <strong className="text-slate-700">5. Endocrino/Diabète :</strong>{' '}
                          <span className={medicalHistory.endocrineChecklist?.length ? 'text-blue-800 font-semibold' : 'text-slate-500'}>
                            {medicalHistory.endocrineChecklist?.length ? medicalHistory.endocrineChecklist.join(', ') : 'R.A.S'}
                          </span>
                        </div>

                        <div>
                          <strong className="text-slate-700">6. Allergies :</strong>{' '}
                          <span className={medicalHistory.allergiesChecklist?.length ? 'text-purple-800 font-bold' : 'text-slate-500'}>
                            {medicalHistory.allergiesChecklist?.length ? medicalHistory.allergiesChecklist.join(', ') : 'Aucune'}
                          </span>
                        </div>

                        {medicalHistory.isPregnantOrNursing && (
                          <div className="col-span-2 text-pink-700 font-bold">
                            <strong>Statut Physiologique :</strong> Grossesse en cours {medicalHistory.pregnancyMonth ? `(${medicalHistory.pregnancyMonth}ème mois)` : ''} / Allaitement
                          </div>
                        )}

                        {medicalHistory.doctorNotes && (
                          <div className="col-span-2 pt-1 border-t border-slate-100 text-slate-800">
                            <strong>Consignes du Praticien :</strong> {medicalHistory.doctorNotes}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Financial Summary */}
          <div className="grid grid-cols-3 gap-3 text-center border border-slate-200 rounded-xl p-3 bg-slate-50 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Soins</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{totalActsDA.toLocaleString()} DA</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Payé</span>
              <span className="font-mono font-bold text-emerald-700 text-sm">{totalPaidDA.toLocaleString()} DA</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Solde Restant</span>
              <span className={`font-mono font-bold text-sm ${remainingDebtDA > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                {remainingDebtDA.toLocaleString()} DA
              </span>
            </div>
          </div>

          {/* Treatments History */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1 flex justify-between">
              <span>Actes & Soins Dentaires Réalisés ({treatments.length})</span>
            </h3>
            {treatments.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-1">Aucun acte enregistré à ce jour.</p>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-500 text-[11px]">
                    <th className="py-1">Date</th>
                    <th className="py-1">Dent</th>
                    <th className="py-1">Description de l'acte</th>
                    <th className="py-1">Statut</th>
                    <th className="py-1 text-right">Tarif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {treatments.slice(0, 10).map((t) => (
                    <tr key={t.id}>
                      <td className="py-1.5 text-slate-600 font-mono text-[11px]">{t.date}</td>
                      <td className="py-1.5 font-bold">{t.toothNumber ? `#${t.toothNumber}` : '—'}</td>
                      <td className="py-1.5 font-medium text-slate-900">{t.actName}</td>
                      <td className="py-1.5 text-[11px] text-slate-600">{t.status === 'COMPLETED' ? 'Terminé' : t.status}</td>
                      <td className="py-1.5 text-right font-mono font-semibold">{t.price.toLocaleString()} DA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Clinical Notes Summary */}
          {notes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1">
                Observations & Notes Cliniques Récentes
              </h3>
              <div className="space-y-1.5 text-xs">
                {notes.slice(0, 3).map((n) => (
                  <div key={n.id} className="p-2 rounded bg-slate-50 border border-slate-200">
                    <div className="flex justify-between text-[11px] text-slate-500 font-semibold mb-0.5">
                      <span>{n.title}</span>
                      <span>{n.date} · {n.practitioner}</span>
                    </div>
                    <p className="text-slate-800 text-xs">{n.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer & Doctor Stamp */}
          <div className="pt-6 border-t-2 border-slate-200 flex justify-between items-end text-xs text-slate-500">
            <div>
              <p className="font-semibold text-slate-700">Document médical confidentiel</p>
              <p className="text-[10px] text-slate-400">Édité le {new Date().toLocaleDateString('fr-FR')} via DentaFlow Algérie</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] font-bold text-slate-700 mb-8">Cachet et Signature du Praticien</p>
              <div className="w-36 border-b border-dashed border-slate-400 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
