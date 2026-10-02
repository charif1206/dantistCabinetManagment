import React, { useState, useEffect, useRef } from 'react'
import { Patient, LabTestOrder, LabTestOrderStatus, PatientRadio, RadioType } from '@shared/types'
import { labTestService, evaluateCriticalLabResults } from '../../services/labTestService'
import { radioService } from '../../services/radioService'
import { useToast } from '../../context/ToastContext'
import NewLabTestOrderModal from '../labTests/NewLabTestOrderModal'
import PrintableLabOrder from '../labTests/PrintableLabOrder'

interface PatientBilansTabProps {
  patient: Patient
  onAlertTriggered?: () => void
}

const LAB_STATUS_CONFIG: Record<LabTestOrderStatus, { label: string; badgeClass: string; icon: string }> = {
  PENDING: { label: 'En attente résultats', badgeClass: 'bg-amber-100 text-amber-900 border-amber-200', icon: 'hourglass_top' },
  RECEIVED: { label: 'Résultats reçus', badgeClass: 'bg-sky-100 text-sky-900 border-sky-200', icon: 'download_done' },
  VALIDATED: { label: 'Bilan validé par praticien', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200', icon: 'verified' }
}

const RADIO_TYPE_BADGES: Record<RadioType, { label: string; color: string; icon: string }> = {
  Panoramique: { label: 'Panoramique (OPG)', color: 'bg-sky-950/80 text-sky-300 border-sky-600/40', icon: 'pan_tool_alt' },
  'Rétro-alvéolaire': { label: 'Rétro-alvéolaire (Apex)', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/40', icon: 'lens_blur' },
  'Scanner 3D': { label: 'Scanner 3D (CBCT)', color: 'bg-purple-950/80 text-purple-300 border-purple-600/40', icon: 'view_in_ar' },
  'Téléradiographie': { label: 'Téléradiographie (TLR)', color: 'bg-amber-950/80 text-amber-300 border-amber-600/40', icon: 'face' },
  Bitewing: { label: 'Bitewing (Interproximal)', color: 'bg-indigo-950/80 text-indigo-300 border-indigo-600/40', icon: 'vertical_split' }
}

export default function PatientBilansTab({
  patient,
  onAlertTriggered
}: PatientBilansTabProps): JSX.Element {
  const { showToast } = useToast()

  const [activeSubTab, setActiveSubTab] = useState<'radios' | 'lab'>('radios')

  // --- Lab Orders State ---
  const [orders, setOrders] = useState<LabTestOrder[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [showNewOrderModal, setShowNewOrderModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState<LabTestOrder | null>(null)
  const [printingOrder, setPrintingOrder] = useState<LabTestOrder | null>(null)
  const [recordingOrder, setRecordingOrder] = useState<LabTestOrder | null>(null)
  const [resultValues, setResultValues] = useState<Record<string, string>>({})
  const [isSavingResults, setIsSavingResults] = useState(false)

  // --- Radiographies State ---
  const [radios, setRadios] = useState<PatientRadio[]>([])
  const [isLoadingRadios, setIsLoadingRadios] = useState(false)
  const [showAddRadioModal, setShowAddRadioModal] = useState(false)

  // Upload Form State
  const [radioType, setRadioType] = useState<RadioType>('Panoramique')
  const [radioTooth, setRadioTooth] = useState<string>('')
  const [radioDate, setRadioDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [radioNotes, setRadioNotes] = useState<string>('')
  const [radioImageData, setRadioImageData] = useState<string>('')
  const [radioFileName, setRadioFileName] = useState<string>('')
  const [radioFileSize, setRadioFileSize] = useState<number>(0)
  const [isSavingRadio, setIsSavingRadio] = useState(false)

  // --- Lightbox State ---
  const [activeLightboxRadio, setActiveLightboxRadio] = useState<PatientRadio | null>(null)
  const [zoom, setZoom] = useState<number>(1)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isInverted, setIsInverted] = useState<boolean>(false)
  const [isHighContrast, setIsHighContrast] = useState<boolean>(false)
  const [rotation, setRotation] = useState<number>(0)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Load Lab Orders
  const loadOrders = async (): Promise<void> => {
    setIsLoadingOrders(true)
    try {
      const data = await labTestService.getLabOrders(patient.id)
      setOrders(data)
    } catch (err: any) {
      console.error('Error loading lab orders:', err)
      showToast('Erreur chargement des analyses', 'error')
    } finally {
      setIsLoadingOrders(false)
    }
  }

  // Load Radios
  const loadRadios = async (): Promise<void> => {
    setIsLoadingRadios(true)
    try {
      const data = await radioService.getRadios(patient.id)
      setRadios(data)
    } catch (err: any) {
      console.error('Error loading radios:', err)
      showToast('Erreur chargement des radiographies', 'error')
    } finally {
      setIsLoadingRadios(false)
    }
  }

  useEffect(() => {
    loadOrders()
    loadRadios()
  }, [patient.id])

  // Reset Lightbox View
  const resetLightboxView = (): void => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setIsInverted(false)
    setIsHighContrast(false)
    setRotation(0)
  }

  // Open Lightbox
  const openLightbox = (radio: PatientRadio): void => {
    resetLightboxView()
    setActiveLightboxRadio(radio)
  }

  // Close Lightbox
  const closeLightbox = (): void => {
    setActiveLightboxRadio(null)
    resetLightboxView()
  }

  // Handle Keyboard Escape in Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && activeLightboxRadio) {
        closeLightbox()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeLightboxRadio])

  // Mouse wheel zoom in Lightbox
  const handleWheelZoom = (e: React.WheelEvent): void => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? 0.2 : -0.2
    setZoom((prev) => Math.min(Math.max(0.5, Number((prev + delta).toFixed(2))), 5))
  }

  // Mouse drag Pan in Lightbox
  const handleMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent): void => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = (): void => {
    setIsDragging(false)
  }

  // File Picker Change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]
    setRadioFileName(file.name)
    setRadioFileSize(file.size)

    const reader = new FileReader()
    reader.onload = (loadEvt) => {
      if (loadEvt.target?.result) {
        setRadioImageData(loadEvt.target.result as string)
      }
    }
    reader.readAsDataURL(file)
  }

  // Save Uploaded Radio
  const handleSaveRadio = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!radioImageData) {
      showToast('Veuillez sélectionner une image de radiographie (JPG, PNG, DICOM, BMP)', 'warning')
      return
    }

    setIsSavingRadio(true)
    try {
      await radioService.saveRadio({
        patientId: patient.id,
        radioType,
        toothNumber: radioTooth ? parseInt(radioTooth, 10) : undefined,
        date: radioDate,
        notes: radioNotes || undefined,
        imageData: radioImageData,
        fileName: radioFileName || 'radio.png',
        fileSize: radioFileSize
      })

      showToast('Radio enregistrée avec succès dans le dossier médical', 'success')
      setShowAddRadioModal(false)
      // Reset form
      setRadioImageData('')
      setRadioFileName('')
      setRadioFileSize(0)
      setRadioNotes('')
      setRadioTooth('')
      await loadRadios()
    } catch (err: any) {
      showToast(`Erreur enregistrement radio : ${err?.message || 'Erreur'}`, 'error')
    } finally {
      setIsSavingRadio(false)
    }
  }

  // Delete Radio
  const handleDeleteRadio = async (e: React.MouseEvent, radio: PatientRadio): Promise<void> => {
    e.stopPropagation()
    if (window.confirm(`Supprimer définitivement ce cliché (${radio.radioType}) du dossier du patient ?`)) {
      try {
        await radioService.deleteRadio(radio.id, patient.id)
        setRadios((prev) => prev.filter((r) => r.id !== radio.id))
        showToast('Radiographie supprimée', 'info')
      } catch (err: any) {
        showToast(`Erreur suppression : ${err?.message || 'Erreur'}`, 'error')
      }
    }
  }

  // Lab Results save
  const handleSaveResults = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!recordingOrder) return

    setIsSavingResults(true)
    try {
      const evalRes = evaluateCriticalLabResults(resultValues)
      const updated = await labTestService.recordResults(
        recordingOrder.id,
        resultValues,
        evalRes.isCritical,
        evalRes.alertMessage || undefined
      )

      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      setRecordingOrder(null)

      if (evalRes.isCritical) {
        showToast(
          `⚠️ ALERTE CRITIQUE DÉTECTÉE : ${evalRes.alertMessage}`,
          'error'
        )
        if (onAlertTriggered) onAlertTriggered()
      } else {
        showToast('Résultats d’analyses enregistrés avec succès', 'success')
      }
    } catch (err: any) {
      showToast(`Erreur enregistrement résultats : ${err?.message || 'Erreur'}`, 'error')
    } finally {
      setIsSavingResults(false)
    }
  }

  // Delete Lab Order
  const handleDeleteOrder = async (id: string, num: string): Promise<void> => {
    if (window.confirm(`Supprimer définitivement la demande d'analyses ${num} ?`)) {
      try {
        await labTestService.deleteLabOrder(id)
        setOrders((prev) => prev.filter((o) => o.id !== id))
        showToast(`Demande d'analyses ${num} supprimée`, 'info')
      } catch (err: any) {
        showToast(`Erreur suppression : ${err?.message || 'Erreur'}`, 'error')
      }
    }
  }

  const criticalOrders = orders.filter((o) => o.isCriticalAlert)
  const pendingOrders = orders.filter((o) => o.status === 'PENDING')

  return (
    <div className="space-y-6">
      {/* Sub-Navigation: Radios vs Lab Tests */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="inline-flex p-1 rounded-xl bg-surface-container border border-outline-variant/60 shadow-2xs">
          <button
            onClick={() => setActiveSubTab('radios')}
            data-testid="tab-radios"
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'radios'
                ? 'bg-surface text-secondary shadow-xs font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">perm_media</span>
            <span>Clichés & Radiographies ({radios.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('lab')}
            data-testid="tab-lab"
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'lab'
                ? 'bg-surface text-secondary shadow-xs font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">biotech</span>
            <span>Analyses Médicales & Biologie ({orders.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === 'radios' ? (
            <button
              onClick={() => {
                setRadioDate(new Date().toISOString().split('T')[0])
                setShowAddRadioModal(true)
              }}
              data-testid="btn-add-radio"
              className="px-4 py-2 bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">add_a_photo</span>
              <span>+ Ajouter une Radio</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setEditingOrder(null)
                setShowNewOrderModal(true)
              }}
              className="px-4 py-2 bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>+ Prescrire Bilan</span>
            </button>
          )}
        </div>
      </div>

      {/* Critical Alert Warning Banner if any critical lab results exists */}
      {criticalOrders.length > 0 && activeSubTab === 'lab' && (
        <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-2xl flex items-start gap-3.5 text-rose-950 animate-pulse shadow-xs">
          <span className="material-symbols-outlined text-rose-600 text-3xl shrink-0">
            warning
          </span>
          <div className="space-y-1">
            <h4 className="font-black text-sm uppercase tracking-wide text-rose-900">
              Alerte Sécurité Biologique Critique Détectée !
            </h4>
            <p className="text-xs text-rose-800 leading-relaxed font-semibold">
              Ce patient présente des résultats d'analyses en zone de danger vital / hémorragique :
            </p>
            <ul className="list-disc list-inside text-xs font-mono font-bold text-rose-950 space-y-0.5">
              {criticalOrders.map((o) => (
                <li key={o.id}>
                  {o.orderNumber} : {o.criticalAlertMessage || 'Anomalie biologique sévère'}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-rose-700 italic pt-1">
              Contre-indication temporaire pour toute chirurgie buccale ou pose d’implant sans avis médical spécialisé.
            </p>
          </div>
        </div>
      )}

      {/* SECTION 1: RADIOGRAPHIES GALLERY */}
      {activeSubTab === 'radios' && (
        <div className="space-y-5">
          {/* Header Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-secondary">
                <span className="material-symbols-outlined text-xl">radiology</span>
                <span className="text-xs font-bold uppercase tracking-wider">
                  Imagerie Dentaire & Négatoscope Numérique
                </span>
              </div>
              <h3 className="text-base font-bold text-on-surface mt-1">
                Clichés Radiologiques — {patient.lastName.toUpperCase()} {patient.firstName}
              </h3>
              <p className="text-xs text-on-surface-variant">
                Panoramiques (OPG), rétro-alvéolaires apicales, Cone Beam 3D et téléradiographies avec zoom haute résolution
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-4 text-xs font-mono px-3.5 py-1.5 rounded-xl bg-surface-container border border-outline-variant/40">
                <div>
                  <span className="text-on-surface-variant block text-[10px]">Total Radios:</span>
                  <strong className="text-secondary font-bold">{radios.length} cliché(s)</strong>
                </div>
                <div className="border-l border-outline-variant/40 pl-3">
                  <span className="text-on-surface-variant block text-[10px]">Dernier Examen:</span>
                  <strong className="text-on-surface font-bold">
                    {radios[0]?.date ? radios[0].date.slice(0, 10) : 'Aucun'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Radios Gallery Grid */}
          {radios.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs p-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-5xl text-outline mb-3">
                perm_media
              </span>
              <p className="font-semibold text-base text-on-surface">
                Aucune radiographie enregistrée pour ce patient
              </p>
              <p className="text-xs text-outline mt-1 mb-5 max-w-md mx-auto">
                Ajoutez un cliché panoramique, rétro-alvéolaire ou scanner 3D pour visualiser les structures osseuses, racines et caries.
              </p>
              <button
                onClick={() => {
                  setRadioDate(new Date().toISOString().split('T')[0])
                  setShowAddRadioModal(true)
                }}
                className="px-5 py-2.5 bg-secondary text-white rounded-xl text-xs font-bold hover:bg-secondary/90 shadow-xs transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">add_a_photo</span>
                <span>+ Ajouter une Radio</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {radios.map((r) => {
                const badge = RADIO_TYPE_BADGES[r.radioType] || RADIO_TYPE_BADGES.Panoramique

                return (
                  <div
                    key={r.id}
                    data-testid="radio-card"
                    className="group relative bg-slate-950 rounded-2xl border border-slate-800 shadow-md overflow-hidden flex flex-col hover:border-sky-500/60 transition-all duration-200"
                  >
                    {/* Dark Viewing Box Thumbnail */}
                    <div
                      onClick={() => openLightbox(r)}
                      data-testid={`btn-open-lightbox-${r.id}`}
                      className="relative aspect-4/3 w-full bg-black flex items-center justify-center cursor-pointer overflow-hidden group-hover:opacity-95"
                    >
                      <img
                        src={r.imageData}
                        alt={`${r.radioType} - ${r.date}`}
                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Hover Overlay with Zoom Icon */}
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 text-white">
                        <span className="material-symbols-outlined text-3xl text-sky-400 drop-shadow">
                          zoom_in
                        </span>
                        <span className="text-[11px] font-bold tracking-wide uppercase bg-sky-950/90 text-sky-300 px-2 py-0.5 rounded-full border border-sky-500/30">
                          Examiner au Négatoscope HD
                        </span>
                      </div>

                      {/* Type Badge Top Left */}
                      <div className="absolute top-2 left-2 z-10">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border backdrop-blur-xs ${badge.color}`}
                        >
                          <span className="material-symbols-outlined text-xs">{badge.icon}</span>
                          <span>{r.radioType}</span>
                        </span>
                      </div>

                      {/* Tooth badge if applicable */}
                      {r.toothNumber && (
                        <div className="absolute top-2 right-2 z-10">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/90 text-slate-950 border border-amber-300">
                            Dent #{r.toothNumber}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Meta & Notes footer */}
                    <div className="p-3 bg-slate-900 border-t border-slate-800/80 flex flex-col justify-between flex-1 gap-2 text-xs">
                      <div>
                        <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">calendar_today</span>
                            <span>{r.date ? r.date.slice(0, 10) : '—'}</span>
                          </span>
                          {r.fileSize ? (
                            <span>{(r.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
                          ) : null}
                        </div>

                        {r.notes ? (
                          <p className="mt-1.5 text-[11px] text-slate-300 line-clamp-2 leading-relaxed" title={r.notes}>
                            {r.notes}
                          </p>
                        ) : (
                          <p className="mt-1.5 text-[11px] text-slate-500 italic">
                            Aucune observation saisie
                          </p>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                        <button
                          onClick={() => openLightbox(r)}
                          className="text-sky-400 hover:text-sky-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">fullscreen</span>
                          <span>Ouvrir</span>
                        </button>

                        <button
                          onClick={(e) => handleDeleteRadio(e, r)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Supprimer ce cliché"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: MEDICAL LAB TESTS & PRE-OP BILANS */}
      {activeSubTab === 'lab' && (
        <div className="space-y-5">
          {/* Header & Quick stats */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-secondary">
                <span className="material-symbols-outlined text-xl">biotech</span>
                <span className="text-xs font-bold uppercase tracking-wider">
                  Biologie Médicale & Analyses Sanguines
                </span>
              </div>
              <h3 className="text-base font-bold text-on-surface mt-1">
                Bilans Pré-opératoires — {patient.lastName.toUpperCase()} {patient.firstName}
              </h3>
              <p className="text-xs text-on-surface-variant">
                Surveillance de la glycémie, hémostase (TP/INR), formule sanguine et dépistages infectieux
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-4 text-xs font-mono px-3.5 py-1.5 rounded-xl bg-surface-container border border-outline-variant/40">
                <div>
                  <span className="text-on-surface-variant block text-[10px]">En Attente:</span>
                  <strong className="text-amber-700 font-bold">{pendingOrders.length} bilans</strong>
                </div>
                <div className="border-l border-outline-variant/40 pl-3">
                  <span className="text-on-surface-variant block text-[10px]">Alertes Critiques:</span>
                  <strong className={`font-bold ${criticalOrders.length > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {criticalOrders.length} alertes
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs overflow-hidden">
            {orders.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl text-outline mb-2">
                  science
                </span>
                <p className="font-semibold text-sm text-on-surface">
                  Aucune prescription d'analyses ou bilan pré-opératoire
                </p>
                <p className="text-xs text-outline mt-1 mb-4">
                  Prescrivez une ordonnance de biologie médicale pour sécuriser vos interventions
                </p>
                <button
                  onClick={() => {
                    setEditingOrder(null)
                    setShowNewOrderModal(true)
                  }}
                  className="px-4 py-2 bg-secondary text-white rounded-xl text-xs font-bold hover:bg-secondary/90 shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>Prescrire un bilan pré-opératoire</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-container-high/40 border-b border-outline-variant/40 text-on-surface-variant font-semibold">
                      <th className="py-3 px-4">N° Bilan</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-4">Motif / Indication</th>
                      <th className="py-3 px-4">Analyses Demandées</th>
                      <th className="py-3 px-4">Résultats Obtenus</th>
                      <th className="py-3 px-3">Statut</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {orders.map((o) => {
                      const cfg = LAB_STATUS_CONFIG[o.status] || LAB_STATUS_CONFIG.PENDING
                      let testsList: string[] = []
                      let resultsMap: Record<string, string> = {}
                      try {
                        testsList = JSON.parse(o.testsRequestedJson || '[]')
                      } catch {
                        testsList = []
                      }
                      try {
                        resultsMap = JSON.parse(o.resultsJson || '{}')
                      } catch {
                        resultsMap = {}
                      }

                      const hasResults = Object.keys(resultsMap).length > 0

                      return (
                        <tr
                          key={o.id}
                          className={`hover:bg-surface-container-low/60 transition-colors ${
                            o.isCriticalAlert ? 'bg-rose-50/50' : ''
                          }`}
                        >
                          {/* Order Number */}
                          <td className="py-3.5 px-4 font-mono font-bold text-secondary">
                            <button
                              onClick={() => setPrintingOrder(o)}
                              className="hover:underline flex items-center gap-1 cursor-pointer"
                              title="Imprimer l'ordonnance d'analyses"
                            >
                              <span className="material-symbols-outlined text-sm">receipt_long</span>
                              <span>{o.orderNumber}</span>
                            </button>
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-3 font-mono text-on-surface">
                            {o.requestDate ? o.requestDate.slice(0, 10) : '—'}
                          </td>

                          {/* Reason */}
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-on-surface block max-w-[180px] truncate" title={o.reason || ''}>
                              {o.reason || 'Bilan de contrôle'}
                            </span>
                            <span className="text-[10px] text-on-surface-variant font-medium">
                              {o.dentistName}
                            </span>
                          </td>

                          {/* Requested Tests */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {testsList.slice(0, 3).map((t, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container text-on-surface font-semibold"
                                >
                                  {t}
                                </span>
                              ))}
                              {testsList.length > 3 && (
                                <span className="text-[10px] text-outline font-semibold">
                                  +{testsList.length - 3} autres
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Results & Critical Evaluation */}
                          <td className="py-3.5 px-4">
                            {o.isCriticalAlert ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[11px] font-bold animate-pulse">
                                  <span className="material-symbols-outlined text-xs">dangerous</span>
                                  Valeur Critique !
                                </span>
                                <p className="text-[10px] text-rose-800 font-mono font-bold truncate max-w-[220px]" title={o.criticalAlertMessage || ''}>
                                  {o.criticalAlertMessage}
                                </p>
                              </div>
                            ) : hasResults ? (
                              <div className="space-y-0.5">
                                {Object.entries(resultsMap).slice(0, 2).map(([k, v]) => (
                                  <div key={k} className="text-[11px] font-mono">
                                    <span className="text-on-surface-variant">{k} : </span>
                                    <strong className="text-slate-800">{v}</strong>
                                  </div>
                                ))}
                                {Object.keys(resultsMap).length > 2 && (
                                  <span className="text-[10px] text-secondary font-semibold">
                                    {Object.keys(resultsMap).length} valeurs saisies
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-outline italic">
                                Non renseigné
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.badgeClass}`}>
                              <span className="material-symbols-outlined text-xs">{cfg.icon}</span>
                              <span>{cfg.label}</span>
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Saisir Résultats button */}
                              <button
                                onClick={() => {
                                  setRecordingOrder(o)
                                  let parsed: Record<string, string> = {}
                                  try {
                                    parsed = JSON.parse(o.resultsJson || '{}')
                                  } catch {
                                    parsed = {}
                                  }
                                  setResultValues(parsed)
                                }}
                                className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-secondary hover:text-white text-on-surface text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                                title="Saisir ou consulter les valeurs retournées par le laboratoire"
                              >
                                <span className="material-symbols-outlined text-sm">edit_note</span>
                                <span>Résultats</span>
                              </button>

                              {/* Print Ordonnance */}
                              <button
                                onClick={() => setPrintingOrder(o)}
                                className="p-1.5 rounded-lg text-secondary hover:bg-secondary-fixed/50 transition-colors cursor-pointer"
                                title="Imprimer l'ordonnance d'analyses"
                              >
                                <span className="material-symbols-outlined text-base">print</span>
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteOrder(o.id, o.orderNumber)}
                                className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/30 transition-colors cursor-pointer"
                                title="Supprimer"
                              >
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: ADD A RADIO [+ Ajouter une Radio] */}
      {showAddRadioModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest text-on-surface w-full max-w-xl rounded-2xl shadow-2xl border border-outline-variant/60 overflow-hidden flex flex-col my-auto animate-in fade-in duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-surface-container-high border-b border-outline-variant/60 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-2xl">radiology</span>
                <div>
                  <h3 className="font-bold text-base">
                    Ajouter une Radiographie Dentaire
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Formats acceptés : JPG, PNG, DICOM (.dcm), BMP, WebP
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddRadioModal(false)}
                className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveRadio} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* File upload drag & drop area */}
              <div className="space-y-1.5">
                <label className="font-bold text-xs text-on-surface">
                  Fichier Image du Cliché <span className="text-error">*</span>
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".jpg,.jpeg,.png,.bmp,.dcm,.dicom,.webp,image/*"
                  data-testid="input-radio-file"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                    radioImageData
                      ? 'border-secondary bg-secondary-fixed/20'
                      : 'border-outline-variant/80 hover:border-secondary bg-surface-container-low/50 hover:bg-surface-container'
                  }`}
                >
                  {radioImageData ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-40 h-28 rounded-lg overflow-hidden bg-black flex items-center justify-center border border-slate-700">
                        <img
                          src={radioImageData}
                          alt="Prévisualisation"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div className="text-center">
                        <span className="font-bold text-secondary text-xs block">{radioFileName}</span>
                        <span className="text-[11px] text-on-surface-variant">
                          {radioFileSize ? `${(radioFileSize / (1024 * 1024)).toFixed(2)} MB — ` : ''}
                          Cliquer pour changer de fichier
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-3 text-on-surface-variant">
                      <span className="material-symbols-outlined text-4xl text-secondary">
                        cloud_upload
                      </span>
                      <p className="font-bold text-xs text-on-surface">
                        Glisser-déposer le cliché ici ou cliquer pour parcourir
                      </p>
                      <p className="text-[11px] text-outline">
                        Prend en charge les radiographies numériques JPG, PNG, DICOM / BMP
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Examination Type */}
                <div className="space-y-1">
                  <label className="font-bold text-xs text-on-surface">
                    Type d'Examen <span className="text-error">*</span>
                  </label>
                  <select
                    value={radioType}
                    onChange={(e) => setRadioType(e.target.value as RadioType)}
                    data-testid="select-radio-type"
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface font-semibold text-xs cursor-pointer"
                  >
                    <option value="Panoramique">Panoramique (OPG)</option>
                    <option value="Rétro-alvéolaire">Rétro-alvéolaire (Apex / Périapicale)</option>
                    <option value="Scanner 3D">Scanner 3D (CBCT Cone Beam)</option>
                    <option value="Téléradiographie">Téléradiographie (TLR)</option>
                    <option value="Bitewing">Bitewing (Interproximal)</option>
                  </select>
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <label className="font-bold text-xs text-on-surface">
                    Date de Réalisation <span className="text-error">*</span>
                  </label>
                  <input
                    type="date"
                    value={radioDate}
                    onChange={(e) => setRadioDate(e.target.value)}
                    data-testid="input-radio-date"
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface font-mono font-bold text-xs"
                    required
                  />
                </div>

                {/* Tooth number (FDI) */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-xs text-on-surface flex items-center justify-between">
                    <span>Dent / Secteur Ciblé (Numérotation FDI)</span>
                    <span className="text-[10px] text-outline font-normal">
                      Optionnel (Laisser vide pour Panoramique / Arcade complète)
                    </span>
                  </label>
                  <input
                    type="number"
                    min="11"
                    max="85"
                    placeholder="Ex: 36, 11, 48..."
                    value={radioTooth}
                    onChange={(e) => setRadioTooth(e.target.value)}
                    data-testid="input-radio-tooth"
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface font-mono font-bold text-xs"
                  />
                </div>

                {/* Clinical Notes */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-xs text-on-surface">
                    Observations & Diagnostic Radiologique
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Contrôle d'obturation canalaire sur 36. Lésion péri-apicale stable. Absence de lésion carieuse proximale."
                    value={radioNotes}
                    onChange={(e) => setRadioNotes(e.target.value)}
                    data-testid="textarea-radio-notes"
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs leading-relaxed"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-outline-variant/60 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddRadioModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingRadio || !radioImageData}
                  data-testid="btn-save-radio"
                  className="px-5 py-2 bg-primary-container text-on-primary hover:bg-on-secondary-fixed-variant rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">
                    {isSavingRadio ? 'sync' : 'check'}
                  </span>
                  <span>{isSavingRadio ? 'Enregistrement...' : 'Enregistrer le Cliché'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: HIGH-RESOLUTION LIGHTBOX VIEWER (المكبر عالي الدقة) */}
      {activeLightboxRadio && (
        <div
          data-testid="radio-lightbox"
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col select-none animate-in fade-in duration-200"
          onWheel={handleWheelZoom}
        >
          {/* Top Diagnostic Toolbar */}
          <div className="px-5 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-4 z-20 flex-wrap">
            {/* Left Info */}
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-sky-400 text-2xl">
                radiology
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-sm">
                    {activeLightboxRadio.radioType}
                  </h4>
                  {activeLightboxRadio.toothNumber && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500 text-slate-950">
                      Dent #{activeLightboxRadio.toothNumber}
                    </span>
                  )}
                  <span className="text-slate-400 text-xs font-mono">
                    {activeLightboxRadio.date?.slice(0, 10)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Patient : <strong className="text-slate-200">{patient.lastName.toUpperCase()} {patient.firstName}</strong> ({patient.patientNumber})
                </p>
              </div>
            </div>

            {/* Center: Radiological Image Processing Tools (Invert, Contrast, Rotate) */}
            <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
              {/* Invert Colors (Négatif / Positif) */}
              <button
                onClick={() => setIsInverted((prev) => !prev)}
                data-testid="btn-toggle-invert"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isInverted
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Inverser les tons (Vue négatif / radio-opacité inversée pour détecter les lésions apicales)"
              >
                <span className="material-symbols-outlined text-base">invert_colors</span>
                <span>Inverser Couleurs</span>
              </button>

              {/* High Contrast */}
              <button
                onClick={() => setIsHighContrast((prev) => !prev)}
                data-testid="btn-toggle-contrast"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isHighContrast
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Haut Contraste (Accentuer les limites de l'émail et du desmodonte)"
              >
                <span className="material-symbols-outlined text-base">contrast</span>
                <span>Contraste Élevé</span>
              </button>

              <div className="w-px h-5 bg-slate-800 mx-1" />

              {/* Rotate 90° */}
              <button
                onClick={() => setRotation((prev) => (prev + 90) % 360)}
                data-testid="btn-rotate"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Pivoter 90°"
              >
                <span className="material-symbols-outlined text-lg">rotate_right</span>
              </button>
            </div>

            {/* Right: Zoom controls & Close */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                {/* Zoom Out */}
                <button
                  onClick={() => setZoom((prev) => Math.max(0.5, Number((prev - 0.25).toFixed(2))))}
                  data-testid="btn-zoom-out"
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Zoom Arrière (-)"
                >
                  <span className="material-symbols-outlined text-lg">zoom_out</span>
                </button>

                <span
                  data-testid="zoom-level-display"
                  className="text-xs font-mono font-bold text-sky-400 px-2 min-w-[50px] text-center"
                >
                  {Math.round(zoom * 100)}%
                </span>

                {/* Zoom In */}
                <button
                  onClick={() => setZoom((prev) => Math.min(5, Number((prev + 0.25).toFixed(2))))}
                  data-testid="btn-zoom-in"
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Zoom Avant (+)"
                >
                  <span className="material-symbols-outlined text-lg">zoom_in</span>
                </button>

                {/* Reset Zoom */}
                <button
                  onClick={() => {
                    setZoom(1)
                    setPan({ x: 0, y: 0 })
                  }}
                  data-testid="btn-zoom-reset"
                  className="px-2 py-1 text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Réinitialiser l'échelle et la position"
                >
                  100%
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={closeLightbox}
                data-testid="btn-close-lightbox"
                className="p-2 text-slate-400 hover:text-white hover:bg-rose-950/80 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-600/40"
                title="Fermer (Échap)"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>
          </div>

          {/* Canvas Area with Interactive Pan & Zoom */}
          <div
            className={`flex-1 relative overflow-hidden flex items-center justify-center ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
              className="max-w-[90vw] max-h-[80vh] flex items-center justify-center"
            >
              <img
                src={activeLightboxRadio.imageData}
                alt="Radiographie Haute Définition"
                data-testid="lightbox-image"
                draggable={false}
                style={{
                  filter: `${isInverted ? 'invert(1) ' : ''}${
                    isHighContrast ? 'contrast(180%) brightness(105%) ' : ''
                  }`.trim()
                }}
                className="max-w-full max-h-full object-contain pointer-events-none rounded shadow-2xl drop-shadow-2xl"
              />
            </div>
          </div>

          {/* Bottom Diagnostic Bar */}
          <div className="px-6 py-2.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 z-20">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-slate-300 font-medium">
                <span className="material-symbols-outlined text-sm text-sky-400">info</span>
                <span>Diagnostic :</span>
              </span>
              <p className="text-slate-200 text-xs italic font-medium">
                {activeLightboxRadio.notes || 'Aucune observation radiologique enregistrée.'}
              </p>
            </div>

            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="text-slate-500">
                Molette : zoomer | Clic & glisser : naviguer | Double-clic : centrer
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                Échelle {Math.round(zoom * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RECORD LAB TEST RESULTS */}
      {recordingOrder && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest text-on-surface w-full max-w-xl rounded-2xl shadow-2xl border border-outline-variant/60 overflow-hidden flex flex-col my-auto animate-in fade-in duration-150">
            <div className="px-6 py-4 bg-surface-container-high border-b border-outline-variant/60 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-2xl">science</span>
                <div>
                  <h3 className="font-bold text-base">
                    Saisie des Résultats d'Analyses — {recordingOrder.orderNumber}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Contrôle automatique des seuils de sécurité (Glycémie &gt; 1.80, INR &gt; 3.0, Plaquettes &lt; 100.000)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRecordingOrder(null)}
                className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveResults} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="space-y-3">
                {(() => {
                  let testNames: string[] = []
                  try {
                    testNames = JSON.parse(recordingOrder.testsRequestedJson || '[]')
                  } catch {
                    testNames = []
                  }

                  return testNames.map((testName) => {
                    const val = resultValues[testName] || ''
                    const singleEval = evaluateCriticalLabResults({ [testName]: val })
                    const isCritical = singleEval.isCritical

                    return (
                      <div
                        key={testName}
                        className={`p-3 rounded-xl border transition-all ${
                          isCritical
                            ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-400/40'
                            : 'bg-surface border-outline-variant/60'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <label className="font-bold text-xs text-on-surface">{testName}</label>
                          {isCritical && (
                            <span className="text-[10px] font-bold text-rose-700 font-mono flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-xs">error</span>
                              Valeur critique !
                            </span>
                          )}
                        </div>

                        <input
                          type="text"
                          placeholder="Ex: 1.05 g/L, 1.15 INR, 220.000 /mm³, Négatif..."
                          value={val}
                          onChange={(e) =>
                            setResultValues((prev) => ({
                              ...prev,
                              [testName]: e.target.value
                            }))
                          }
                          className={`w-full px-3 py-1.5 rounded-lg border text-xs font-mono font-bold ${
                            isCritical
                              ? 'border-rose-500 bg-white text-rose-700'
                              : 'border-outline-variant bg-surface-container-low text-on-surface'
                          }`}
                        />
                      </div>
                    )
                  })
                })()}
              </div>

              {/* Real-time Evaluation Summary */}
              {(() => {
                const evalRes = evaluateCriticalLabResults(resultValues)
                if (evalRes.isCritical) {
                  return (
                    <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-xs text-rose-900 font-semibold space-y-1">
                      <div className="flex items-center gap-1 font-bold">
                        <span className="material-symbols-outlined text-sm text-rose-700">warning</span>
                        <span>Alerte de Sécurité Clinique :</span>
                      </div>
                      <p className="text-[11px] font-mono leading-relaxed">{evalRes.alertMessage}</p>
                    </div>
                  )
                }
                return null
              })()}

              <div className="pt-3 border-t border-outline-variant/60 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRecordingOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingResults}
                  className="px-5 py-2 bg-primary-container text-on-primary hover:bg-on-secondary-fixed-variant rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSavingResults ? 'Enregistrement...' : 'Valider & Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: NEW LAB ORDER */}
      {showNewOrderModal && (
        <NewLabTestOrderModal
          isOpen={showNewOrderModal}
          onClose={() => {
            setShowNewOrderModal(false)
            setEditingOrder(null)
          }}
          onSuccess={(savedOrder, shouldPrint) => {
            loadOrders()
            if (shouldPrint) {
              setPrintingOrder(savedOrder)
            }
          }}
          initialPatient={patient}
          existingOrder={editingOrder}
        />
      )}

      {/* MODAL 5: PRINTABLE LAB ORDER */}
      {printingOrder && (
        <PrintableLabOrder
          order={printingOrder}
          patient={patient}
          onClose={() => setPrintingOrder(null)}
        />
      )}
    </div>
  )
}
