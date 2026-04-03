# Hangya - Ant Flight Predictor

A responsive web app that predicts ant nuptial flight conditions based on weather data. "Hangya" means "ant" in Hungarian.

## Overview

Hangya fetches hourly weather forecasts from the Open-Meteo API and scores each hour for ant nuptial flight probability (0-100) based on temperature, humidity, precipitation, wind, sunlight, and multi-day weather patterns. The scoring model distinguishes between spring and summer flight conditions.

## Data Availability and Provenance Statements

### Weather Data

Weather forecast data is fetched in real time from the [Open-Meteo API](https://open-meteo.com/). Open-Meteo provides free access to weather forecast APIs without requiring an API key. Data includes hourly temperature, humidity, precipitation, surface pressure, wind speed, soil moisture, and cloud cover. No data is redistributed; it is fetched on demand by the client.

### Ant Flight Condition Data

Scoring parameters are based on field observations of ant nuptial flight conditions. The condition table is embedded in the source code (`src/lib/scoring.ts`).

## Computational Requirements

### Software Requirements

- Node.js 18+
- npm

### Instructions to Replicators

```bash
make install   # Install dependencies
make dev       # Start development server
make build     # Build for production
make preview   # Preview production build
```

### Runtime

- Build time: <30 seconds
- Storage: <50 MB (including node_modules)

## Description of Programs

| File | Purpose |
|------|---------|
| `src/lib/scoring.ts` | Ant flight scoring model with season-specific weights |
| `src/lib/weather.ts` | Open-Meteo API client with response caching |
| `src/lib/location.ts` | Browser geolocation and reverse geocoding |
| `src/lib/storage.ts` | localStorage wrapper for saved locations and preferences |
| `src/lib/alerts.ts` | Browser notification and service worker registration |
| `src/App.tsx` | Main application component |
| `src/components/` | UI components (ScoreCard, HourlyTimeline, WeatherDetails, etc.) |
| `public/sw.js` | Service worker for PWA offline support |

## License

MIT
