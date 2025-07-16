# Embeddable Appointment Request Form

A lightweight, brand-ready React widget for scheduling appointments at senior living communities.

## Features

- React component or standalone JS embed
- Enquire Solutions API integration
- Customizable branding and theming
- Form validation and error handling
- Success feedback and redirection

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Configuration

1. Copy the example file and adjust values:

```bash
cp .env.example .env.local
```

2. Edit `.env.local` and add **server-only** credentials and public settings:

```bash
# -- Server-side (never exposed to the browser) -----------------
ENQUIRE_API_KEY=your_real_api_key               # required
# ENQUIRE_API_ENDPOINT=https://api2.enquiresolutions.com/2/Individual/  # optional

# -- Public (safe to expose) ------------------------------------
NEXT_PUBLIC_COMMUNITY_NAME=Your Community Name   # required
# NEXT_PUBLIC_PRIMARY_COLOR=#0066cc
# NEXT_PUBLIC_LOGO_URL=/logo.svg
```

```
# ⚠️  Do NOT put secrets (API keys, private endpoints) in variables that
# start with `NEXT_PUBLIC_` – these are embedded in client-side bundles.
```

## Documentation

See project files for detailed documentation and usage examples.

## Security & API Architecture

The browser no longer talks directly to Enquire.  
Instead, form data is POSTed to **`/api/submit-appointment`**, a server-side
Next.js API route that:

1. Validates and transforms the payload  
2. Reads `ENQUIRE_API_KEY` from the *server* environment (never sent to the
   client)  
3. Calls the Enquire Solutions endpoint and returns a minimal response to
   the browser  

This design keeps sensitive credentials out of the client bundle and allows
centralised error handling, rate-limiting or additional security checks.

## Error Logging

The project ships with a lightweight logger:

* `src/lib/logger.ts` – configurable levels, timestamps and context tagging  
* Console output in development, ready to forward to remote services  
* Global listeners (`window.onerror`, `unhandledrejection`) and a React
  `ErrorBoundary` ensure unexpected issues are surfaced quickly  

Validation and submission errors inside **`AppointmentForm`** are also logged
with contextual information to aid debugging.
