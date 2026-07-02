# Arvind GCC — HR Platform

Enterprise HR voice screening frontend built to the **Arvind GCC Design System** specification.

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** — dev server & build
- **Tailwind CSS** — design tokens & styling
- **React Router** — navigation
- **Lucide React** — outline icons
- **Recharts** — line & donut charts

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

## Pages

| Route                  | Page                                              |
| ---------------------- | ------------------------------------------------- |
| `/`                    | Dashboard — KPI cards, upload section             |
| `/new-campaign`        | New Campaign — upload, AI config, start screening |
| `/campaign-monitoring` | Live campaign dashboard, tables, AI agent card    |
| `/reports`             | Campaign reports                                  |
| `/analytics`           | Metrics, progress cards, line & donut charts      |
| `/settings`            | Profile, AI agent, notifications, security        |
| `/help`                | Support & FAQ                                     |

## Design System

- **Primary:** Deep Maroon `#A61D3A`
- **Font:** Inter (400 body, 600 buttons, 700 headings)
- **Layout:** 12-column grid, 1440px max width, 280px sidebar, 72px header
- **Spacing:** 8px system · **Radius:** cards 16px, buttons/inputs 10px, popups 20px
