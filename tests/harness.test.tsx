import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { Patient, ElectronAPI } from '@shared/types'
import { ALGERIAN_WILAYAS } from '@renderer/utils/algerianWilayas'
import { validateAlgerianPhone } from '@renderer/utils/validators'

describe('DentaFlow Test Harness & Environment', () => {
  it('resolves @shared and @renderer path aliases properly', () => {
    expect(ALGERIAN_WILAYAS).toBeDefined()
    expect(ALGERIAN_WILAYAS.length).toBeGreaterThan(50)
    expect(ALGERIAN_WILAYAS[0].code).toBe('01')

    expect(validateAlgerianPhone('0555123456').isValid).toBe(true)
    expect(validateAlgerianPhone('123456').isValid).toBe(false)
  })

  it('has window.api fully mocked with ElectronAPI methods', async () => {
    expect(window.api).toBeDefined()
    expect(typeof window.api.getPatients).toBe('function')
    expect(typeof window.api.savePatient).toBe('function')
    expect(typeof window.api.getAppointments).toBe('function')
    expect(typeof window.api.getDrugsCatalog).toBe('function')
    expect(typeof window.api.getInvoices).toBe('function')
    expect(typeof window.api.getToothRecords).toBe('function')
    expect(typeof window.api.getDevis).toBe('function')
    expect(typeof window.api.getProstheticLabs).toBe('function')
    expect(typeof window.api.getWaitingRoomEntries).toBe('function')
    expect(typeof window.api.getClinicalOverviewStats).toBe('function')

    const patients = await window.api.getPatients()
    expect(Array.isArray(patients)).toBe(true)

    const testPatient: Omit<Patient, 'id' | 'patientNumber' | 'createdAt' | 'updatedAt' | 'syncStatus'> = {
      firstName: 'Fatima',
      lastName: 'Zahra',
      phone: '0661234567'
    }

    const saved = await window.api.savePatient(testPatient)
    expect(saved.id).toBeDefined()
    expect(saved.firstName).toBe('Fatima')
  })

  it('renders React components into JSDOM and supports jest-dom matchers', () => {
    function DummyCard({ title }: { title: string }) {
      return (
        <div data-testid="clinic-card" className="p-4 bg-white rounded-lg shadow">
          <h1>{title}</h1>
          <button onClick={() => window.api.printDocument()}>Imprimer</button>
        </div>
      )
    }

    render(<DummyCard title="DentaFlow Algeria" />)

    const card = screen.getByTestId('clinic-card')
    expect(card).toBeInTheDocument()
    expect(screen.getByText('DentaFlow Algeria')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /imprimer/i })).toBeInTheDocument()
  })
})
