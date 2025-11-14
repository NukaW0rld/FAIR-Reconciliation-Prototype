# Rev Reconciliation App

A React web application for engineering change order (ECO) reconciliation and management.

## Setup Instructions

### Prerequisites
- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Features

- Upload and manage Rev A/B PDF files and Form-3 spreadsheets
- Detect changes between revisions
- Review and approve/dismiss individual changes
- Edit change requirements and notes
- Export delta packets for FAIR auditing
- Modern dark theme UI with Tailwind CSS

## Technology Stack

- React 18
- Vite (build tool)
- Tailwind CSS (styling)
- JSZip (file compression)
- PostCSS with Autoprefixer

## Project Structure

```
├── src/
│   ├── App.jsx          # Main React component
│   ├── main.jsx         # Application entry point
│   └── index.css        # Tailwind CSS imports
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── vite.config.js       # Vite configuration
├── tailwind.config.js   # Tailwind configuration
└── postcss.config.js    # PostCSS configuration
```
