/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100'
      },
      colors: {
        'on-background': '#181c1e',
        'on-tertiary-container': '#009c25',
        'on-surface-variant': '#43474e',
        'on-surface': '#181c1e',
        'surface-tint': '#476083',
        'outline-variant': '#c4c6cf',
        'on-primary-container': '#6f88ad',
        'outline': '#74777f',
        'primary-fixed': '#d4e3ff',
        'tertiary-fixed-dim': '#4be253',
        'surface-container-lowest': '#ffffff',
        'tertiary-container': '#002503',
        'on-tertiary-fixed-variant': '#00530f',
        'on-secondary-container': '#002e5d',
        'primary-container': '#001f3f',
        'surface-container': '#ebeef0',
        'inverse-primary': '#afc8f0',
        'on-primary': '#ffffff',
        'surface-container-low': '#f1f4f6',
        'on-primary-fixed': '#001c3a',
        'error': '#ba1a1a',
        'error-container': '#ffdad6',
        'secondary-container': '#4597fe',
        'surface-dim': '#d7dadc',
        'surface-bright': '#f7fafc',
        'on-secondary': '#ffffff',
        'on-secondary-fixed-variant': '#004788',
        'surface-container-highest': '#e0e3e5',
        'primary': '#000613',
        'on-tertiary': '#ffffff',
        'on-error': '#ffffff',
        'on-tertiary-fixed': '#002203',
        'inverse-on-surface': '#eef1f3',
        'tertiary-fixed': '#72ff72',
        'surface-variant': '#e0e3e5',
        'on-primary-fixed-variant': '#2f486a',
        'secondary-fixed': '#d5e3ff',
        'surface-container-high': '#e5e9eb',
        'on-secondary-fixed': '#001b3b',
        'inverse-surface': '#2d3133',
        'surface': '#f7fafc',
        'background': '#f7fafc',
        'primary-fixed-dim': '#afc8f0',
        'secondary': '#005eb2',
        'tertiary': '#000800',
        'secondary-fixed-dim': '#a7c8ff'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ]
}
