import React, { useState, useEffect } from 'react'
import { Patient } from '@shared/types'
import { patientService } from '../../services/patientService'
import { useToast } from '../../context/ToastContext'
import { useNavigation } from '../../context/NavigationContext'
import { validateAlgerianPhone, validateRequiredField } from '../../utils/validators'
import { ALGERIAN_WILAYAS } from '../../utils/algerianWilayas'

interface NewPatientModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (patient: Patient) => void
  existingPatients?: Patient[]
}

export const NewPatientModal: React.FC<NewPatientModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingPatients = []
}) => {
  const { showToast } = useToast()
  const { openPatient } = useNavigation()

  const getInitialFormState = () => {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000)
    return {
      firstName: 'Karim',
      lastName: 'Mebarki',
      cin: `16${randomSuffix}`,
      phone: `0550${randomSuffix}`,
      email: `karim.mebarki${randomSuffix % 1000}@gmail.com`,
      dateOfBirth: '1992-06-15',
      gender: 'M' as 'M' | 'F',
      wilaya: '16 - Alger',
      medicalAlerts: 'Allergie à la Pénicilline',
      bloodGroup: 'O+',
      notes: 'Patient régulier - Première consultation détartrage et contrôle'
    }
  }

  const [formData, setFormData] = useState(getInitialFormState)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialFormState())
      setTouched({})
      setErrors({})
      setIsSubmitting(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  // Validation unitaire d'un champ
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'firstName': {
        const res = validateRequiredField(value, 'Prénom')
        return res.isValid ? '' : res.error || 'Le prénom est obligatoire.'
      }
      case 'lastName': {
        const res = validateRequiredField(value, 'Nom')
        return res.isValid ? '' : res.error || 'Le nom est obligatoire.'
      }
      case 'phone': {
        const res = validateAlgerianPhone(value)
        if (!res.isValid) {
          return (
            res.error ||
            'Numéro invalide. Format requis : 05/06/07 suivi de 8 chiffres (10 chiffres au total).'
          )
        }
        // Vérification de doublon
        const cleaned = value.trim().replace(/[\s\-_.]/g, '')
        const duplicate = existingPatients.find(
          (p) => p.phone && p.phone.trim().replace(/[\s\-_.]/g, '') === cleaned
        )
        if (duplicate) {
          return 'Ce numéro de téléphone existe déjà pour un autre patient.'
        }
        return ''
      }
      case 'cin': {
        if (!value || !value.trim()) return ''
        const cleaned = value.trim().toUpperCase()
        const duplicate = existingPatients.find(
          (p) => p.cin && p.cin.trim().toUpperCase() === cleaned
        )
        if (duplicate) {
          return 'Ce numéro CIN existe déjà pour un autre patient.'
        }
        return ''
      }
      default:
        return ''
    }
  }

  const handleBlur = (field: string): void => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    const errorMsg = validateField(field, (formData as any)[field] || '')
    setErrors((prev) => ({ ...prev, [field]: errorMsg }))
  }

  const handleChange = (field: string, value: string): void => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (touched[field]) {
      const errorMsg = validateField(field, value)
      setErrors((prev) => ({ ...prev, [field]: errorMsg }))
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    // Marquer tous les champs obligatoires comme touchés
    const allTouched = {
      firstName: true,
      lastName: true,
      phone: true,
      cin: true
    }
    setTouched(allTouched)

    // Valider tous les champs
    const fnErr = validateField('firstName', formData.firstName)
    const lnErr = validateField('lastName', formData.lastName)
    const phErr = validateField('phone', formData.phone)
    const cinErr = validateField('cin', formData.cin)

    const newErrors: Record<string, string> = {}
    if (fnErr) newErrors.firstName = fnErr
    if (lnErr) newErrors.lastName = lnErr
    if (phErr) newErrors.phone = phErr
    if (cinErr) newErrors.cin = cinErr

    setErrors(newErrors)

    // S'il y a des erreurs, afficher un Toast d'erreur rouge explicite et bloquer
    if (Object.keys(newErrors).length > 0) {
      if (phErr && phErr.includes('existe déjà')) {
        showToast('Ce numéro de téléphone existe déjà pour un autre patient', 'error')
      } else if (cinErr && cinErr.includes('existe déjà')) {
        showToast('Ce numéro CIN existe déjà pour un autre patient', 'error')
      } else {
        const firstError = Object.values(newErrors)[0]
        showToast(firstError || 'Veuillez corriger les erreurs dans le formulaire.', 'error')
      }
      return
    }

    try {
      setIsSubmitting(true)
      const created = await patientService.savePatient(formData)
      showToast(
        `Dossier patient créé avec succès pour ${created.firstName} ${created.lastName}`,
        'success'
      )
      onClose()
      onSuccess?.(created)
      openPatient(created, 'overview')
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la création du patient', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-outline-variant/50 flex items-center justify-between bg-surface-container-low shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-secondary-fixed text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">person_add</span>
            </div>
            <div>
              <h3 className="font-bold text-base text-on-surface">Créer un Dossier Patient</h3>
              <p className="text-xs text-on-surface-variant font-medium">
                Contexte Algérie · Téléphone 05/06/07 · 58 Wilayas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Prénom & Nom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Prénom <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                onBlur={() => handleBlur('firstName')}
                className={`w-full px-3 py-2 rounded-xl border bg-surface text-sm transition-all focus:ring-2 focus:outline-hidden ${
                  touched.firstName && errors.firstName
                    ? 'border-error ring-1 ring-error/50 bg-error-container/10 focus:border-error focus:ring-error/40'
                    : 'border-outline-variant focus:ring-secondary/40 focus:border-secondary'
                }`}
                placeholder="Ex: Amine"
              />
              {touched.firstName && errors.firstName && (
                <p className="mt-1 text-xs font-medium text-error flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">error</span>
                  <span>{errors.firstName}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Nom de famille <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                onBlur={() => handleBlur('lastName')}
                className={`w-full px-3 py-2 rounded-xl border bg-surface text-sm transition-all focus:ring-2 focus:outline-hidden ${
                  touched.lastName && errors.lastName
                    ? 'border-error ring-1 ring-error/50 bg-error-container/10 focus:border-error focus:ring-error/40'
                    : 'border-outline-variant focus:ring-secondary/40 focus:border-secondary'
                }`}
                placeholder="Ex: Mansouri"
              />
              {touched.lastName && errors.lastName && (
                <p className="mt-1 text-xs font-medium text-error flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">error</span>
                  <span>{errors.lastName}</span>
                </p>
              )}
            </div>
          </div>

          {/* Téléphone & CIN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Téléphone (05 / 06 / 07) <span className="text-error">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                onBlur={() => handleBlur('phone')}
                className={`w-full px-3 py-2 rounded-xl border bg-surface text-sm transition-all focus:ring-2 focus:outline-hidden font-mono ${
                  touched.phone && errors.phone
                    ? 'border-error ring-1 ring-error/50 bg-error-container/10 focus:border-error focus:ring-error/40'
                    : 'border-outline-variant focus:ring-secondary/40 focus:border-secondary'
                }`}
                placeholder="0550123456"
              />
              {touched.phone && errors.phone && (
                <p className="mt-1 text-xs font-medium text-error flex items-start gap-1">
                  <span className="material-symbols-outlined text-xs mt-0.5 shrink-0">error</span>
                  <span>{errors.phone}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                N° CNI / NIN (Facultatif)
              </label>
              <input
                type="text"
                value={formData.cin}
                onChange={(e) => handleChange('cin', e.target.value)}
                onBlur={() => handleBlur('cin')}
                className={`w-full px-3 py-2 rounded-xl border bg-surface text-sm transition-all focus:ring-2 focus:outline-hidden font-mono ${
                  touched.cin && errors.cin
                    ? 'border-error ring-1 ring-error/50 bg-error-container/10 focus:border-error focus:ring-error/40'
                    : 'border-outline-variant focus:ring-secondary/40 focus:border-secondary'
                }`}
                placeholder="Ex: 1092837465"
              />
              {touched.cin && errors.cin && (
                <p className="mt-1 text-xs font-medium text-error flex items-start gap-1">
                  <span className="material-symbols-outlined text-xs mt-0.5 shrink-0">error</span>
                  <span>{errors.cin}</span>
                </p>
              )}
            </div>
          </div>

          {/* Date de naissance, Genre & Groupe Sanguin */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Date de Naissance</label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-sm focus:ring-2 focus:ring-secondary/40 focus:border-secondary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Genre</label>
              <select
                value={formData.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-sm focus:ring-2 focus:ring-secondary/40 focus:border-secondary"
              >
                <option value="M">Homme</option>
                <option value="F">Femme</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Groupe Sanguin</label>
              <select
                value={formData.bloodGroup}
                onChange={(e) => handleChange('bloodGroup', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-sm focus:ring-2 focus:ring-secondary/40 focus:border-secondary font-semibold"
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
          </div>

          {/* Wilaya (58 Wilayas) */}
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Wilaya de Résidence (Algérie)
            </label>
            <select
              value={formData.wilaya}
              onChange={(e) => handleChange('wilaya', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-sm focus:ring-2 focus:ring-secondary/40 focus:border-secondary"
            >
              {ALGERIAN_WILAYAS.map((w) => (
                <option key={w.code} value={w.name}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Alertes Médicales & Allergies */}
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Alertes Médicales / Allergies / Antécédents
            </label>
            <input
              type="text"
              value={formData.medicalAlerts}
              onChange={(e) => handleChange('medicalAlerts', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-sm focus:ring-2 focus:ring-secondary/40 focus:border-secondary"
              placeholder="Ex: Allergie Pénicilline, Diabète, Cardiopathie, Anticoagulant"
            />
          </div>

          {/* Notes Internes */}
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">Notes Cliniques Internes</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-sm focus:ring-2 focus:ring-secondary/40 focus:border-secondary"
              placeholder="Remarques particulières, préférences patient, etc."
            />
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-outline-variant/40 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-secondary hover:bg-secondary/90 disabled:opacity-50 text-on-secondary text-sm font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>Enregistrer le Patient</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default NewPatientModal
