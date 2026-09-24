# dantistCabinetManagment

# 🦷 DentaFlow - Modern Dental Clinic Management System

**DentaFlow** is a comprehensive, offline-first desktop management application designed specifically for dental clinics and dental practitioners. Built with modern web technologies packaged inside Electron, DentaFlow provides real-time local responsiveness with SQLite, paired with background cloud synchronization capabilities.

---

## ✨ Features

- **📋 Patient Management (Dossier Patient):**
  - Complete digital patient records (personal information, medical background, systemic allergies, risk factors).
  - Chronological consultation and treatment history.
  - Search and filter patients instantaneously.

- **🦷 Interactive Odontogram (Dental Chart):**
  - Adult & pediatric dental arch visualization.
  - Tooth-by-tooth status tracking (healthy, caries, treated, missing, crown, bridge, implant).
  - Treatment assignment directly from the visual chart.

- **📅 Appointment Scheduling:**
  - Intuitive calendar and agenda views for clinic appointments.
  - Status management (Scheduled, Confirmed, Completed, Cancelled).
  - Patient visit workflow optimization.

- **💰 Billing & Financial Tracking:**
  - Treatment pricing, quote generation, and invoicing.
  - Patient balance tracking (total due, paid amounts, outstanding debts).
  - Daily, monthly, and yearly clinic revenue analytics.

- **📄 Prescriptions & Documents:**
  - Pre-formatted dental prescription generation.
  - Medical certificates and printable receipts.

- **🔒 Offline-First & Hybrid Cloud Sync:**
  - Fast local performance using **SQLite (WAL mode)** via `better-sqlite3`.
  - Zero downtime even without internet access.
  - Optional background synchronization engine with Firebase Firestore for multi-device clinics.

---

## 🛠️ Tech Stack

- **Core & Runtime:** [Electron](https://www.electronjs.org/) (v32+) with [electron-vite](https://electron-vite.org/)
- **Frontend:** [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/), [Lucide React Icons](https://lucide.dev/)
- **Local Database:** [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **Cloud Synchronization:** Firebase / Firestore Sync Adapter
- **Packaging & Distribution:** [electron-builder](https://www.electron.build/) (NSIS Windows Installer)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.x or v20.x recommended)
- `npm` or `yarn` / `pnpm`
- Windows build tools (for compiling native `better-sqlite3` bindings, if needed)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/charif1206/dantistCabinetManagment.git
   cd dantistCabinetManagment
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Copy the example environment configuration:
   ```bash
   cp .env.example .env
   ```
   *(Adjust machine and Firebase sync parameters if using cloud sync).*

---

## 💻 Development & Build Scripts

- **Run in Development Mode:**
  ```bash
  npm run dev
  ```

- **Type Check:**
  ```bash
  npm run typecheck
  ```

- **Build Application:**
  ```bash
  npm run build
  ```

- **Package for Windows (Installer .exe):**
  ```bash
  npm run build:win
  ```

---

## 📁 Project Structure

```
├── data/                    # Local SQLite database & automated backups
├── src/
│   ├── main/                # Electron main process (IPC handlers, SQLite, Window manager)
│   ├── preload/             # Electron preload scripts (contextBridge security layer)
│   ├── renderer/            # React frontend (UI components, views, hooks, stores)
│   └── shared/              # Shared types, interfaces, and DTOs
├── electron.vite.config.ts  # Vite configuration for main, preload, and renderer
├── tailwind.config.js       # Tailwind CSS design tokens and theme settings
└── package.json             # Application dependencies and scripts
```

---

## 📄 License

This software is developed for dental clinic practice management. All rights reserved.
