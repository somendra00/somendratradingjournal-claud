# Somendra's Trading Journal

A dark-mode trading journal dashboard built with React, Tailwind CSS, Recharts, and Lucide icons.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Outputs a static site to `dist/`.

## Deploy to Cloudflare Workers (static assets)

```bash
npx wrangler deploy
```

This project deploys as a static asset Worker — there's no server-side Worker
script, `wrangler.jsonc` just points Cloudflare at the `dist/` folder produced
by `npm run build`.

In the Cloudflare dashboard, set:
- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`

## Project structure

```
index.html
src/
  main.jsx       # React entry point
  App.jsx        # The dashboard (all views: Dashboard, Journal, Analytics, Goals, Data)
  index.css      # Tailwind directives
wrangler.jsonc   # Cloudflare Workers static asset config
vite.config.js
tailwind.config.js
postcss.config.js
```
