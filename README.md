# Embeddable Appointment Request Form

A lightweight, brand-ready React widget for scheduling appointments at senior living communities.

## Features

- React component or standalone JS embed
- Enquire Solutions API integration
- Customizable branding and theming
- Form validation and error handling
- Success feedback and redirection
- Single backend that can serve **multiple communities** (white-label friendly)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Configuration

> **Prerequisites**
> * Node ≥ 16 and npm ≥ 8  
> * A valid **Enquire Solutions** API key  
> * (Optional) per-community API keys for white-label deployments  

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

Extensive “living” docs are included in the codebase:

| Topic | Where |
|-------|-------|
| **Component props** | `src/components/AppointmentForm/AppointmentForm.tsx` |
| **Embed API** | `public/embed.js` – JSDoc at top of file |
| **Server route** | `src/pages/api/submit-appointment.ts` |
| **Demo playground** | `http://localhost:3000/demo` after `npm run dev` |

Below is a condensed reference of the most-used patterns.

---

## Architecture & Security

```
 Browser <iframe/embed.js>
        │  (POST /api/submit-appointment)
        ▼
 Next.js API Route ─▶ Enquire Solutions API
```

* The **client bundle never contains secrets** – they stay on the server.  
* The `/api/submit-appointment` route validates, transforms and forwards data.  
* Per-community API credentials can override the default key for true
  white-label isolation.  
* All errors funnel through a central logger (`logger.ts`) enabling future
  Sentry / Datadog integration with one line of code.  

---

## Multi-Community & White-Label Deployment

Need to use the *same* deployment across dozens of partner sites?  
The widget accepts the community name (and optional branding) at **runtime** and
submits to the correct Enquire account while your API key stays on the server.

### Server-side set-up

1. Add each community to the allow-list or numbered variables in `.env.local`
   ```
   ALLOWED_COMMUNITIES=Sunny Acres Assisted Living,Oakwood Estates,Harbor Lights

   # community-specific credentials (optional, falls back to defaults)
   ENQUIRE_API_KEY_SUNNY_ACRES_ASSISTED_LIVING=abc123
   ENQUIRE_API_KEY_OAKWOOD_ESTATES=def456
   ```
2. Redeploy – the `/api/submit-appointment` route will pick the right key based
   on the incoming `CommunityName` field.

### Embedding the form

Drop the helper script on **any** website.  
The only required attribute is `data-community`.

```html
<!-- On partner-site.com -->
<script
  src="https://forms.your-domain.com/embed.js"
  data-community="Sunny Acres Assisted Living"
  data-color="#0066cc"
  data-target="#form-here">
</script>

<div id="form-here"></div>
```

Want a different site to show Oakwood Estates?

```html
<script
  src="https://forms.your-domain.com/embed.js"
  data-community="Oakwood Estates"
  data-color="#2c5e2e"
  data-logo="https://cdn.example.com/oakwood/logo.svg"
  data-target="#widget">
</script>
<div id="widget"></div>
```

### Embed-script parameters

| Attribute             | Required | Purpose                                              |
|-----------------------|----------|------------------------------------------------------|
| `data-community`      | Yes      | Exact community name as defined in Enquire           |
| `data-color`          | No       | Primary brand colour (hex)                           |
| `data-secondary-color`| No       | Secondary / background colour                        |
| `data-logo`           | No       | URL to a logo shown at the top of the form           |
| `data-button-text`    | No       | Override submit-button label                         |
| `data-target`         | No       | CSS selector of the container (defaults to `body`)   |
| `data-height`/`width` | No       | Explicit iframe dimensions (otherwise auto-resize)   |

The embed JS dispatches `formSubmitted` and `formError` post-messages, allowing
host sites to hook into analytics or show custom confirmation modals.

## Security & API Architecture

See “Architecture & Security” above for the full flow.  
Key points:

1. **Zero-exposure** of API keys – only the server knows them.  
2. **Community whitelist** ensures rogue sites cannot spam your account.  
3. Supports **per-community API keys & endpoints** for granular control.  
4. SSR-friendly and deploy-ready for Vercel/Netlify/Docker.  

## Error Logging

The project ships with a lightweight logger:

* `src/lib/logger.ts` – configurable levels, timestamps and context tagging  
* Console output in development, ready to forward to remote services  
* Global listeners (`window.onerror`, `unhandledrejection`) and a React
  `ErrorBoundary` ensure unexpected issues are surfaced quickly  

Validation and submission errors inside **`AppointmentForm`** are also logged
with contextual information to aid debugging.

---

## Advanced Customisation

| Area | How |
|------|-----|
| **Fields / layout** | Fork `AppointmentForm.tsx` or inject via `children` prop |
| **Validation rules** | Update `validationSchema` (Yup) inside component |
| **Styling** | Override CSS variables (`--primary-color`, `--secondary-color`) or supply a Tailwind config |
| **Analytics hooks** | Subscribe to `formSubmitted` / `formError` post-messages, or add callbacks in `AppointmentForm` props |
| **Internationalisation** | Pass translated labels via props or load strings from CMS |

---

## Development & Contribution

1. `npm i && npm run dev` to start on `http://localhost:3000`.  
2. Lint & format before committing: `npm run lint && npm run format`.  
3. Write tests in `__tests__/` (Jest + React Testing Library).  
4. Open a PR following the conventional-commit format (`feat:`, `fix:` …).  

### Helpful scripts

| Script | Purpose |
|--------|---------|
| `dev` | local dev with hot-reload |
| `build` | production build |
| `export` | static export (`out/`) for CDN hosting |
| `analyze` | bundle-analyzer report |

---

## Production Checklist

- [ ] Add real domain to `EMBED_BASE_URL`  
- [ ] Provide HTTPS certs (Auto via Vercel)  
- [ ] Populate `ALLOWED_COMMUNITIES` whitelist  
- [ ] Set `NODE_ENV=production` and disable mock mode  
- [ ] Hook remote logger (Sentry / Datadog) via `logger.ts`  
