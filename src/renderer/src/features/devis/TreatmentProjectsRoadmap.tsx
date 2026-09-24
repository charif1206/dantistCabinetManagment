import React, { useState, useEffect } from 'react'
import { TreatmentProject, TreatmentProjectPhase, Patient } from '@shared/types'
import { devisService } from '../../services/devisService'
import { useToast } from '../../context/ToastContext'

interface TreatmentProjectsRoadmapProps {
  patient: Patient
  onProjectUpdated?: () => void
}

const PRESET_TEMPLATES = [
  {
    title: 'Orthodontie Bi-Maxillaire Complète',
    specialty: 'ODF',
    estimatedTotalDA: 90000,
    phases: [
      { phaseNumber: 1, title: 'Bilan ODF & Empreintes', description: 'Téléradiographie de profil, photos cliniques & moulages d’étude', status: 'COMPLETED' },
      { phaseNumber: 2, title: 'Pose de l’Appareillage Multi-bagues', description: 'Collage des brackets céramiques / métalliques bi-maxillaires', status: 'IN_PROGRESS' },
      { phaseNumber: 3, title: 'Alignement & Nivellement (Arc 0.14 NiTi)', description: 'Changement des ligatures & contrôle des points de contact', status: 'PENDING' },
      { phaseNumber: 4, title: 'Nivellement Intermédiaire (Arc 0.16 NiTi)', description: 'Contrôle des rotations & nivellement de la courbe de Spee', status: 'PENDING' },
      { phaseNumber: 5, title: 'Fermeture d’Espaces (Arcs Rectangulaires)', description: 'Chaînettes élastiques & recul canin', status: 'PENDING' },
      { phaseNumber: 6, title: 'Finition & Coordination des Arcades', description: 'Élastiques intermaxillaires de classe II / III', status: 'PENDING' },
      { phaseNumber: 7, title: 'Débagage & Nettoyage des Composites', description: 'Dépose des brackets, détartrage et polissage des surfaces', status: 'PENDING' },
      { phaseNumber: 8, title: 'Contention Fixe & Gouttière Nocturne', description: 'Fil de contention collé canino-canin + gouttière thermoformée', status: 'PENDING' }
    ]
  },
  {
    title: 'Réhabilitation Implantaire & Prothèse Transvissée',
    specialty: 'IMPLANT',
    estimatedTotalDA: 110000,
    phases: [
      { phaseNumber: 1, title: 'Bilan Scanner 3D & Planification', description: 'Analyse Cône Beam, densité osseuse et guide chirurgical', status: 'COMPLETED' },
      { phaseNumber: 2, title: 'Chirurgie de Pose de l’Implant', description: 'Incision, forage séquencé, pose implant & vis de couverture', status: 'IN_PROGRESS' },
      { phaseNumber: 3, title: 'Contrôle & Dépose des Fils (J+10)', description: 'Vérification de la cicatrisation muqueuse & hygiène', status: 'PENDING' },
      { phaseNumber: 4, title: 'Période d’Ostéointégration (3 mois)', description: 'Maturation osseuse péri-implantaire sans mise en charge', status: 'PENDING' },
      { phaseNumber: 5, title: 'Pose de la Vis de Cicatrisation', description: 'Dégagement muqueux sous anesthésie locale & conformation du collet', status: 'PENDING' },
      { phaseNumber: 6, title: 'Empreinte Implantaire avec Transfert', description: 'Prise d’empreinte ciel ouvert/fermé & choix de la teinte', status: 'PENDING' },
      { phaseNumber: 7, title: 'Pose Définitive de la Couronne Zircone', description: 'Transvissage au couple recommandé (30 N.cm) & contrôle occlusal', status: 'PENDING' }
    ]
  }
]

export default function TreatmentProjectsRoadmap({
  patient,
  onProjectUpdated
}: TreatmentProjectsRoadmapProps): JSX.Element {
  const { showToast } = useToast()
  const [projects, setProjects] = useState<TreatmentProject[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  // New Project Modal State
  const [showNewModal, setShowNewModal] = useState(false)
  const [projectTitle, setProjectTitle] = useState('')
  const [projectSpecialty, setProjectSpecialty] = useState('ODF')
  const [estimatedTotalDA, setEstimatedTotalDA] = useState<number>(80000)
  const [templateIndex, setTemplateIndex] = useState<number>(0)
  const [customPhases, setCustomPhases] = useState<TreatmentProjectPhase[]>([])

  const loadProjects = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const list = await devisService.getTreatmentProjects(patient.id)
      setProjects(list)
      if (list.length > 0 && !selectedProjectId) {
        setSelectedProjectId(list[0].id)
      }
    } catch (err: any) {
      console.error('Error loading treatment projects:', err)
      showToast('Erreur chargement des plans de traitement', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [patient.id])

  // Select template in creation modal
  const handleSelectTemplate = (idx: number): void => {
    setTemplateIndex(idx)
    const t = PRESET_TEMPLATES[idx]
    if (t) {
      setProjectTitle(t.title)
      setProjectSpecialty(t.specialty)
      setEstimatedTotalDA(t.estimatedTotalDA)
      setCustomPhases(
        t.phases.map((p) => ({
          ...p,
          status: p.status as any
        }))
      )
    }
  }

  // Toggle Phase Status in active project
  const handleTogglePhase = async (
    project: TreatmentProject,
    phaseNumber: number
  ): Promise<void> => {
    let phases: TreatmentProjectPhase[] = []
    try {
      phases = JSON.parse(project.roadmapJson || '[]')
    } catch {
      phases = []
    }

    const updatedPhases = phases.map((p) => {
      if (p.phaseNumber === phaseNumber) {
        const nextStatus =
          p.status === 'COMPLETED'
            ? 'PENDING'
            : p.status === 'PENDING'
            ? 'IN_PROGRESS'
            : 'COMPLETED'
        return {
          ...p,
          status: nextStatus,
          completedDate: nextStatus === 'COMPLETED' ? new Date().toISOString().slice(0, 10) : undefined
        }
      }
      return p
    })

    const completedCount = updatedPhases.filter((p) => p.status === 'COMPLETED').length
    const totalCount = updatedPhases.length
    const newProjectStatus =
      completedCount === totalCount
        ? 'COMPLETED'
        : completedCount > 0
        ? 'IN_PROGRESS'
        : 'PLANNED'

    try {
      await devisService.saveTreatmentProject({
        id: project.id,
        patientId: project.patientId,
        title: project.title,
        specialty: project.specialty,
        status: newProjectStatus,
        totalPhases: totalCount,
        completedPhases: completedCount,
        estimatedTotalDA: project.estimatedTotalDA,
        startDate: project.startDate,
        targetEndDate: project.targetEndDate,
        roadmapJson: JSON.stringify(updatedPhases)
      })

      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id
            ? {
                ...p,
                status: newProjectStatus,
                completedPhases: completedCount,
                roadmapJson: JSON.stringify(updatedPhases)
              }
            : p
        )
      )
      showToast('Progression mise à jour', 'success')
      if (onProjectUpdated) onProjectUpdated()
    } catch (err: any) {
      showToast(`Erreur mise à jour : ${err?.message || 'Erreur'}`, 'error')
    }
  }

  // Create Project
  const handleCreateProject = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!projectTitle.trim()) {
      showToast('Le titre du projet est obligatoire', 'error')
      return
    }

    try {
      const created = await devisService.saveTreatmentProject({
        patientId: patient.id,
        title: projectTitle.trim(),
        specialty: projectSpecialty,
        status: 'IN_PROGRESS',
        totalPhases: customPhases.length || 1,
        completedPhases: customPhases.filter((p) => p.status === 'COMPLETED').length,
        estimatedTotalDA: Number(estimatedTotalDA) || 0,
        startDate: new Date().toISOString().slice(0, 10),
        roadmapJson: JSON.stringify(customPhases)
      })

      setProjects((prev) => [created, ...prev])
      setSelectedProjectId(created.id)
      setShowNewModal(false)
      showToast(`Plan de traitement "${created.title}" créé avec succès`, 'success')
      if (onProjectUpdated) onProjectUpdated()
    } catch (err: any) {
      showToast(`Erreur création : ${err?.message || 'Erreur'}`, 'error')
    }
  }

  // Delete Project
  const handleDeleteProject = async (id: string, title: string): Promise<void> => {
    if (window.confirm(`Supprimer définitivement le plan "${title}" ?`)) {
      try {
        await devisService.deleteTreatmentProject(id)
        setProjects((prev) => prev.filter((p) => p.id !== id))
        if (selectedProjectId === id) setSelectedProjectId(null)
        showToast('Plan de traitement supprimé', 'info')
      } catch (err: any) {
        showToast(`Erreur suppression : ${err?.message || 'Erreur'}`, 'error')
      }
    }
  }

  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0]

  let activePhases: TreatmentProjectPhase[] = []
  if (activeProject) {
    try {
      activePhases = JSON.parse(activeProject.roadmapJson || '[]')
    } catch {
      activePhases = []
    }
  }

  const completionPct = activeProject
    ? Math.round((activeProject.completedPhases / (activeProject.totalPhases || 1)) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-secondary">
            <span className="material-symbols-outlined text-xl">conversion_path</span>
            <span className="text-xs font-bold uppercase tracking-wider">
              Plans de Traitement Séquencés (Roadmaps ODF & Implant)
            </span>
          </div>
          <h3 className="text-base font-bold text-on-surface mt-1">
            Parcours de Soins Long Terme — {patient.lastName.toUpperCase()} {patient.firstName}
          </h3>
          <p className="text-xs text-on-surface-variant">
            Suivi étape par étape des séances d'orthodontie, d'implantologie et de réhabilitation globale
          </p>
        </div>

        <button
          onClick={() => {
            handleSelectTemplate(0)
            setShowNewModal(true)
          }}
          className="px-4 py-2 bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">add_task</span>
          <span>+ Nouveau Plan Séquencé</span>
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="p-12 text-center text-on-surface-variant bg-surface-container-lowest rounded-2xl border border-outline-variant/60">
          <span className="material-symbols-outlined text-4xl text-outline mb-2">
            timeline
          </span>
          <p className="font-semibold text-sm text-on-surface">
            Aucun plan de traitement séquencé pour ce patient
          </p>
          <p className="text-xs text-outline mt-1 mb-4">
            Créez une feuille de route pour guider les séances d'orthodontie ou d'implantologie
          </p>
          <button
            onClick={() => {
              handleSelectTemplate(0)
              setShowNewModal(true)
            }}
            className="px-4 py-2 bg-secondary text-white rounded-xl text-xs font-bold hover:bg-secondary/90 shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>Créer un plan de traitement (ODF / Implant)</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects List Selector */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
              Plans du Patient ({projects.length})
            </span>
            <div className="space-y-2">
              {projects.map((proj) => {
                const isSelected = activeProject?.id === proj.id
                const pct = Math.round((proj.completedPhases / (proj.totalPhases || 1)) * 100)
                return (
                  <div
                    key={proj.id}
                    onClick={() => setSelectedProjectId(proj.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-surface-container border-secondary shadow-xs ring-1 ring-secondary/40'
                        : 'bg-surface-container-lowest border-outline-variant/60 hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary uppercase font-mono">
                        {proj.specialty}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        proj.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}>
                        {proj.status === 'COMPLETED' ? 'Terminé' : 'En cours'}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-on-surface mt-2 truncate">
                      {proj.title}
                    </h4>

                    {/* Progress Bar */}
                    <div className="mt-2.5 space-y-1">
                      <div className="flex justify-between text-[11px] text-on-surface-variant">
                        <span>Progression</span>
                        <strong className="text-slate-800 font-mono">
                          {proj.completedPhases}/{proj.totalPhases} ({pct}%)
                        </strong>
                      </div>
                      <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            pct === 100 ? 'bg-emerald-500' : 'bg-secondary'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Active Project Roadmap Timeline (Col 2 & 3) */}
          {activeProject && (
            <div className="lg:col-span-2 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/60 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-outline-variant/40">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-secondary/10 text-secondary">
                      {activeProject.specialty}
                    </span>
                    <h3 className="text-base font-black text-on-surface">
                      {activeProject.title}
                    </h3>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Budget estimatif : <strong className="font-mono text-slate-800 font-bold">{activeProject.estimatedTotalDA.toLocaleString()} DA</strong>
                    {activeProject.startDate && ` • Démarré le ${activeProject.startDate}`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteProject(activeProject.id, activeProject.title)}
                    className="p-2 text-outline hover:text-error hover:bg-error-container/30 rounded-xl transition-colors cursor-pointer"
                    title="Supprimer ce plan"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>

              {/* Graphical Progress Banner */}
              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/40 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-on-surface-variant block">
                    Avancement des séances cliniques
                  </span>
                  <p className="text-2xl font-black text-secondary mt-0.5">
                    {completionPct}% <span className="text-xs font-semibold text-on-surface-variant">réalisé</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-white border border-outline-variant/60 shadow-2xs">
                    {activeProject.completedPhases} sur {activeProject.totalPhases} étapes
                  </span>
                </div>
              </div>

              {/* Step by Step Timeline */}
              <div className="space-y-4 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-outline-variant/60">
                {activePhases.map((phase) => {
                  const isDone = phase.status === 'COMPLETED'
                  const isInProgress = phase.status === 'IN_PROGRESS'

                  return (
                    <div
                      key={phase.phaseNumber}
                      className={`relative flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                        isDone
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : isInProgress
                          ? 'bg-sky-50/50 border-sky-300 ring-2 ring-sky-400/40 shadow-xs'
                          : 'bg-surface border-outline-variant/40 hover:bg-surface-container-low'
                      }`}
                    >
                      {/* Step Circle / Checkbox */}
                      <button
                        onClick={() => handleTogglePhase(activeProject, phase.phaseNumber)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer transition-all shadow-xs z-10 ${
                          isDone
                            ? 'bg-emerald-600 text-white'
                            : isInProgress
                            ? 'bg-sky-600 text-white ring-2 ring-sky-300'
                            : 'bg-surface-container-high text-on-surface-variant hover:bg-secondary hover:text-white'
                        }`}
                        title="Cliquer pour changer le statut de la phase"
                      >
                        {isDone ? (
                          <span className="material-symbols-outlined text-lg">check</span>
                        ) : (
                          phase.phaseNumber
                        )}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h5 className={`font-bold text-sm ${isDone ? 'line-through text-slate-500' : 'text-on-surface'}`}>
                            Séance {phase.phaseNumber} : {phase.title}
                          </h5>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isDone
                              ? 'bg-emerald-100 text-emerald-800'
                              : isInProgress
                              ? 'bg-sky-100 text-sky-800 animate-pulse'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}>
                            {isDone ? 'Complété' : isInProgress ? 'En cours' : 'À planifier'}
                          </span>
                        </div>

                        {phase.description && (
                          <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                            {phase.description}
                          </p>
                        )}

                        {phase.completedDate && (
                          <p className="text-[10px] text-emerald-700 font-mono mt-1 flex items-center gap-1 font-semibold">
                            <span className="material-symbols-outlined text-xs">verified</span>
                            <span>Réalisé le {phase.completedDate}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest text-on-surface w-full max-w-2xl rounded-2xl shadow-2xl border border-outline-variant/60 overflow-hidden flex flex-col my-auto animate-in fade-in duration-150">
            <div className="px-6 py-4 bg-surface-container-high border-b border-outline-variant/60 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-2xl">route</span>
                <h3 className="font-bold text-base">Nouveau Plan de Traitement Séquencé</h3>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Preset Templates */}
              <div className="space-y-1.5">
                <label className="font-bold text-on-surface block">
                  Choisir un Gabarit Clinique Prédéfini
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_TEMPLATES.map((tmpl, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectTemplate(idx)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        templateIndex === idx
                          ? 'border-secondary bg-secondary-fixed/20 shadow-xs'
                          : 'border-outline-variant/60 bg-surface hover:bg-surface-container-low'
                      }`}
                    >
                      <span className="font-mono text-[10px] text-secondary font-bold block">
                        {tmpl.specialty}
                      </span>
                      <strong className="text-xs text-on-surface block mt-0.5">{tmpl.title}</strong>
                      <span className="text-[10px] text-on-surface-variant block mt-1">
                        {tmpl.phases.length} étapes standardisées
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Title & Specialty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-on-surface">Intitulé du Plan *</label>
                  <input
                    type="text"
                    required
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-on-surface">Budget Total Estimé (DA)</label>
                  <input
                    type="number"
                    step={1000}
                    value={estimatedTotalDA}
                    onChange={(e) => setEstimatedTotalDA(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl border border-outline-variant bg-surface text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Preview of Phases */}
              <div className="space-y-1.5 pt-2">
                <label className="font-bold text-on-surface block">
                  Aperçu des Séances ({customPhases.length})
                </label>
                <div className="divide-y divide-outline-variant/30 border border-outline-variant/60 rounded-xl max-h-48 overflow-y-auto">
                  {customPhases.map((p) => (
                    <div key={p.phaseNumber} className="p-2.5 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-secondary/10 text-secondary font-mono font-bold flex items-center justify-center text-[10px]">
                        {p.phaseNumber}
                      </span>
                      <div className="min-w-0">
                        <strong className="text-[11px] text-on-surface block truncate">{p.title}</strong>
                        <span className="text-[10px] text-outline truncate block">{p.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-outline-variant/60 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary-container text-on-primary hover:bg-on-secondary-fixed-variant rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Créer le Plan Séquencé
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
