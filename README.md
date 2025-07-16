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
