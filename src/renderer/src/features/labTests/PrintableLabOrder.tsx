import React, { useState } from 'react'
import { LabTestOrder, Patient } from '@shared/types'
import { printService } from '../../services/printService'
import { useToast } from '../../context/ToastContext'

interface PrintableLabOrderProps {
  order: LabTestOrder
  patient?: Patient | null
  onClose: () => void
}

export default function PrintableLabOrder({
  order,
  patient,
  onClose
}: PrintableLabOrderProps): JSX.Element {
  const { showToast } = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const handlePrint = async (): Promise<void> => {
    await printService.printDocument({ printBackground: true })
  }

  const handleExportPDF = async (): Promise<void> => {
    setIsExporting(true)
    try {
      const res = await printService.exportToPDF({
        title: `Ordonnance_Analyses_${order.orderNumber || order.id}`,
        pageSize: 'A4'
      })
      if (res.success && res.filePath) {
        showToast(`Ordonnance d'analyses enregistrée en PDF : ${res.filePath}`, 'success')
      }
    } catch (err: any) {
      showToast(`Erreur export PDF : ${err?.message || 'Erreur'}`, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  let tests: string[] = []
  try {
    tests = JSON.parse(order.testsRequestedJson || '[]')
  } catch {
    tests = []
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-white text-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col my-auto print:my-0 print:border-none print:shadow-none print:max-w-none print:rounded-none">
        {/* Screen Toolbar (hidden in print) */}
        <div className="px-6 py-3.5 bg-slate-100 border-b border-slate-200 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="material-symbols-outlined text-secondary">biotech</span>
            <span className="font-bold text-sm">
              Ordonnance d'Analyses Médicales & Imagerie (Format A4 / A5)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-secondary text-white rounded-lg text-xs font-semibold hover:bg-secondary/90 shadow-xs cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              <span>Imprimer</span>
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
              <span>{isExporting ? 'Export...' : 'Exporter PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 cursor-pointer transition-colors"
              title="Fermer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Printable Prescription Body */}
        <div className="p-8 sm:p-10 space-y-6 text-sm print:p-6 print:space-y-4 font-sans min-h-[500px] flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-secondary pb-4">
              <div>
                <div className="flex items-center gap-2 text-secondary">
                  <span className="material-symbols-outlined text-3xl">dentistry</span>
                  <span className="text-xl font-black tracking-tight uppercase">
                    Cabinet Dentaire
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-800 mt-1">
                  {order.dentistName || 'Dr. Mohamed Amrani'}
                </h2>
                <p className="text-xs text-slate-600">Chirurgien Dentiste — Omnipratique & Chirurgie Buccale</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  12 Boulevard des Martyrs, Alger • Tél: 021 65 43 21 / 0550 12 34 56
                </p>
              </div>

              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-secondary text-white font-mono font-bold text-xs rounded uppercase tracking-wider">
                  Biologie & Imagerie
                </span>
                <p className="font-mono text-base font-black text-slate-900 mt-1.5">
                  {order.orderNumber}
                </p>
                <p className="text-xs text-slate-500">
                  Alger, le : <strong className="text-slate-900">{formatDate(order.requestDate)}</strong>
                </p>
              </div>
            </div>

            {/* Patient Header */}
            <div className="mt-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                  Prescription délivrée pour :
                </span>
                <p className="text-base font-black text-slate-900">
                  {patient ? `${patient.lastName.toUpperCase()} ${patient.firstName}` : 'Patient'}
                </p>
              </div>
              <div className="text-right text-xs text-slate-600">
                {patient?.patientNumber && (
                  <p>Dossier N° : <strong className="font-mono text-slate-800">{patient.patientNumber}</strong></p>
                )}
                {patient?.dateOfBirth && (
                  <p>Né(e) le : {new Date(patient.dateOfBirth).toLocaleDateString('fr-FR')}</p>
                )}
              </div>
            </div>

            {/* Clinical Indication */}
            {order.reason && (
              <div className="mt-4 p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-slate-800">
                <span className="font-bold text-amber-900 block mb-0.5">
                  Renseignement Clinique / Motif de l'examen :
                </span>
                <p className="italic">{order.reason}</p>
              </div>
            )}

            {/* Requested Tests Section */}
            <div className="mt-6 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center justify-between">
                <span>Prière de réaliser au laboratoire les examens suivants :</span>
                <span className="font-mono text-[11px] text-secondary font-bold">{tests.length} analyse(s)</span>
              </h3>

              <div className="divide-y divide-slate-100 py-2">
                {tests.map((testName, idx) => (
                  <div key={idx} className="py-2.5 flex items-center gap-3">
                    <span className="w-5 h-5 rounded-md border-2 border-secondary flex items-center justify-center text-secondary font-bold text-xs shrink-0">
                      ✓
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{testName}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Laboratory Advisory Note */}
            <div className="mt-6 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-secondary">notifications_active</span>
                <span>Avis au médecin biologiste / laboratoire d'analyses :</span>
              </p>
              <p className="text-[11px] leading-relaxed">
                Prière de communiquer d'urgence les résultats au praticien en cas de valeurs critiques, notamment :
                <strong> Glycémie à jeun &gt; 1.80 g/L</strong>,
                <strong> INR &gt; 3.0</strong>, ou
                <strong> Plaquettes &lt; 100.000 /mm³</strong>.
              </p>
            </div>
          </div>

          {/* Footer & Signature */}
          <div className="pt-8 border-t border-slate-200 flex justify-between items-end">
            <div className="text-[10px] text-slate-400">
              Cabinet Dentaire Dr. Amrani — Système DentaFlow Algérie
            </div>

            <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center min-w-[200px] min-h-[100px] flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase">
                Cachet & Signature
              </span>
              <div className="text-[11px] text-slate-400 font-serif italic">
                Dr. Mohamed Amrani
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
