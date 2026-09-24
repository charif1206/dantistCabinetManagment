import React, { useState, useEffect } from 'react'
import { ClinicalNote } from '@shared/types'
import { clinicalService } from '../../services/clinicalService'

interface ClinicalNotesTabProps {
  patientId: string
  practitionerName?: string
}

export default function ClinicalNotesTab({
  patientId,
  practitionerName = 'Dr. Amrani'
}: ClinicalNotesTabProps): JSX.Element {
  const [notes, setNotes] = useState<ClinicalNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  // New Note State
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ClinicalNote['category']>('CONSULTATION')
  const [content, setContent] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [isSaving, setIsSaving] = useState(false)

  const loadNotes = async (): Promise<void> => {
    try {
      const data = await clinicalService.getClinicalNotes(patientId)
      setNotes(data)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadNotes()
  }, [patientId])

  const handleSaveNote = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!title || !content) return

    setIsSaving(true)
    try {
      await clinicalService.saveClinicalNote({
        patientId,
        practitioner: practitionerName,
        date,
        title,
        category,
        content
      })
      setTitle('')
      setContent('')
      setShowAddForm(false)
      await loadNotes()
    } finally {
      setIsSaving(false)
    }
  }

  const getCategoryBadge = (cat: ClinicalNote['category']): JSX.Element => {
    switch (cat) {
      case 'EMERGENCY':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-error-container text-error border border-error/30 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">emergency</span>
            Urgence
          </span>
        )
      case 'PROCEDURE':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-secondary-fixed text-on-secondary-fixed flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">dentistry</span>
            Acte & Soin
          </span>
        )
      case 'PRESCRIPTION':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">prescriptions</span>
            Ordonnance
          </span>
        )
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-tertiary-fixed text-on-tertiary-container flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">stethoscope</span>
            Consultation
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-xs flex justify-between items-center">
        <div>
          <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">description</span>
            <span>Notes Cliniques & Observations</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-semibold">
              {notes.length}
            </span>
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Historique complet des observations médicales, examens cliniques et diagnostics.
          </p>
        </div>

        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary-container hover:bg-on-secondary-fixed-variant text-on-primary text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Nouvelle Note</span>
          </button>
        )}
      </div>

      {/* New Note Form */}
      {showAddForm && (
        <form
          onSubmit={handleSaveNote}
          className="bg-surface-container-lowest border-2 border-secondary/40 rounded-2xl p-6 shadow-sm space-y-4 animate-in fade-in duration-200"
        >
          <div className="flex justify-between items-center pb-3 border-b border-outline-variant/40">
            <h4 className="font-bold text-sm text-secondary flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">edit_note</span>
              <span>Rédiger une observation clinique</span>
            </h4>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-outline hover:text-on-surface p-1 rounded-lg"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                Titre / Motif <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Examen bucco-dentaire initial"
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs font-medium text-on-surface transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                Catégorie
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ClinicalNote['category'])}
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs font-medium text-on-surface transition-colors cursor-pointer"
              >
                <option value="CONSULTATION">Consultation Générale</option>
                <option value="PROCEDURE">Acte & Soin Réalisé</option>
                <option value="EMERGENCY">Urgence Dentaire</option>
                <option value="PRESCRIPTION">Prescription Médicamenteuse</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                Date de consultation
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs font-medium text-on-surface transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
              Observations médicales détaillées <span className="text-error">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Ex: Patient signale une douleur spontanée nocturne au niveau de la dent 36. Percussion axiale positive, sondage parodontal normal. Cliché rétro-alvéolaire montre une lésion péri-apicale. Proposition d'un traitement endodontique..."
              className="w-full p-3 rounded-xl bg-surface border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-xs text-on-surface resize-none transition-colors"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">save</span>
              <span>{isSaving ? 'Enregistrement...' : 'Enregistrer la note'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Notes Timeline List */}
      {isLoading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-secondary">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          <span className="text-xs font-medium">Chargement des notes cliniques...</span>
        </div>
      ) : notes.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-12 text-center text-on-surface-variant text-xs space-y-2">
          <span className="material-symbols-outlined text-3xl text-outline">note_stack</span>
          <p>Aucune note clinique enregistrée pour ce dossier.</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-secondary font-semibold hover:underline"
          >
            Créer la première observation clinique
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-xs transition-all hover:border-secondary/50 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-outline-variant/30">
                <div className="flex items-center gap-2.5">
                  {getCategoryBadge(note.category)}
                  <h4 className="font-bold text-sm text-on-surface">{note.title}</h4>
                </div>
                <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">person</span>
                    <span>{note.practitioner}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">calendar_today</span>
                    <span className="font-medium">{note.date}</span>
                  </span>
                </div>
              </div>
              <p className="text-xs text-on-surface leading-relaxed whitespace-pre-wrap">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
