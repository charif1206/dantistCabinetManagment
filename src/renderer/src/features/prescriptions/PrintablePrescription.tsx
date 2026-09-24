import React, { useState } from 'react'
import { Prescription, Patient } from '@shared/types'
import { printService } from '../../services/printService'
import { useToast } from '../../context/ToastContext'

interface PrintablePrescriptionProps {
  prescription: Prescription
  patient: Patient
  onClose: () => void
}

export default function PrintablePrescription({
  prescription,
  patient,
  onClose
}: PrintablePrescriptionProps): JSX.Element {
  const { showToast } = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const handlePrint = async (): Promise<void> => {
    await printService.printDocument({ printBackground: true })
  }

  const handleExportPDF = async (): Promise<void> => {
    setIsExporting(true)
    try {
      const res = await printService.exportToPDF({
        title: `Ordonnance_${patient.firstName}_${patient.lastName}`,
        pageSize: 'A5'
      })
      if (res.success && res.filePath) {
        showToast(`Ordonnance enregistrée en PDF : ${res.filePath}`, 'success')
      }
    } catch (err: any) {
      showToast(`Erreur export PDF : ${err?.message || 'Erreur'}`, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  // Calculate patient age
  const calculateAge = (dob?: string): string => {
    if (!dob) return ''
    const birthYear = new Date(dob).getFullYear()
    const currentYear = new Date().getFullYear()
    return `${currentYear - birthYear} ans`
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible">
      <div className="bg-white text-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col my-auto print:my-0 print:border-none print:shadow-none print:max-w-none print:rounded-none">
        {/* Screen Toolbar (hidden in print) */}
        <div className="px-6 py-3.5 bg-slate-100 border-b border-slate-200 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="material-symbols-outlined text-secondary">print</span>
            <span className="font-bold text-sm">Aperçu avant Impression — Ordonnance Médicale (Format A5)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="px-3 py-2 bg-surface hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Enregistrer l'ordonnance en PDF"
            >
              <span className="material-symbols-outlined text-base text-rose-600">picture_as_pdf</span>
              <span>{isExporting ? 'Export...' : 'Exporter PDF'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-secondary hover:bg-secondary/90 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
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

        {/* Printable Prescription Body (Standard Algerian Clinic A5 Format) */}
        <div className="p-8 sm:p-12 space-y-8 bg-white min-h-[600px] flex flex-col justify-between" id="printable-ordonnance">
          {/* Clinic Header */}
          <div className="border-b-2 border-slate-800 pb-5 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                {prescription.dentistName || 'Dr. Amrani'}
              </h1>
              <p className="text-xs font-bold text-secondary uppercase tracking-wider mt-0.5">
                Chirurgien-Dentiste
              </p>
              <p className="text-[11px] text-slate-600 mt-1">
                Soins, Prothèses Dentaires & Chirurgie Orale
              </p>
              <p className="text-[11px] text-slate-600">
                Tél : <span className="font-semibold">0550 12 34 56</span> / <span className="font-semibold">021 65 43 21</span>
              </p>
            </div>

            <div className="text-right">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl ml-auto mb-1">
                <span className="material-symbols-outlined text-2xl">dentistry</span>
              </div>
              <span className="text-[11px] font-bold text-slate-700 block">DentaFlow Clinic DZ</span>
              <span className="text-[10px] text-slate-500">Alger, Algérie</span>
            </div>
          </div>

          {/* Patient Details & Date */}
          <div className="flex justify-between items-center text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-500 uppercase tracking-wider font-semibold">Patient(e) :</span>{' '}
              <strong className="text-slate-900 font-bold text-sm ml-1">
                {patient.firstName} {patient.lastName}
              </strong>
              {patient.dateOfBirth && (
                <span className="text-slate-600 ml-2">({calculateAge(patient.dateOfBirth)})</span>
              )}
            </div>
            <div>
              <span className="text-slate-500 uppercase tracking-wider font-semibold">Date :</span>{' '}
              <strong className="text-slate-900 font-bold ml-1">{prescription.date}</strong>
            </div>
          </div>

          {/* Prescription Medicines List */}
          <div className="flex-1 py-4 space-y-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center border-b border-dashed border-slate-200 pb-2">
              — Prescription Médicamenteuse —
            </h3>

            <ol className="space-y-5 list-decimal list-inside">
              {prescription.items.map((item, idx) => (
                <li key={idx} className="space-y-1 text-slate-800">
                  <span className="font-bold text-sm text-slate-950">
                    {item.medicineName} {item.dosage}
                  </span>
                  {item.form && <span className="text-xs text-slate-600 font-medium ml-1">({item.form})</span>}
                  <div className="pl-5 text-xs text-slate-700 italic font-medium">
                    ↳ Posologie : {item.instructions}
                  </div>
                </li>
              ))}
            </ol>

            {prescription.notes && (
              <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-600">
                <strong className="text-slate-800">Conseils & Recommandations :</strong> {prescription.notes}
              </div>
            )}
          </div>

          {/* Stamp & Signature Footer */}
          <div className="pt-8 border-t border-slate-200 flex justify-between items-end">
            <div className="text-[10px] text-slate-400 font-mono">
              Fiche N° {patient.patientNumber} · Ordonnance sécurisée DentaFlow
            </div>
            <div className="text-center w-48">
              <span className="text-xs font-semibold text-slate-600 block mb-12">Signature & Griffe</span>
              <div className="border-t border-dashed border-slate-400 pt-1 text-[11px] font-bold text-slate-700">
                {prescription.dentistName || 'Dr. Amrani'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
