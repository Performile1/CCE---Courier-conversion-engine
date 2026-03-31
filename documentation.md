
# 📦 Performile Strategic Intelligence - Systemdokumentation

**Version:** App: v4.3 | Protokoll: v6.7 (Batch) / v8.2 (Djup)
**Teknologi:** React (TypeScript), Tailwind CSS, Google Gemini API (`@google/genai`).
**Syfte:** Ett B2B Sales Intelligence-verktyg för att identifiera, kvalificera och segmentera potentiella kunder baserat på fraktpotential (Performile-metodiken).

---

## 1. Systemöversikt & Arkitektur

Applikationen är en **Single Page Application (SPA)** som körs helt i webbläsaren men använder Google Gemini som backend-motor för datahämtning och analys.

### Kärnprinciper
1.  **AI-driven Datahämtning:** Använder LLM (Large Language Models) med Google Search Grounding för att hämta realtidsdata från Allabolag, Ratsit, Proff, Linkedin och Bolagsverket.
2.  **Strikt Segmentering:** Segmenterar automatiskt företag i **TS** (Telesales), **FS** (Field Sales) och **KAM** (Key Account Management) baserat på en **5%-regel** (Estimerad frakt = 5% av omsättning).
3.  **Lead Reservoir (Cache):** En lokal databas ("Cachen") sparar *alla* hittade företag för att minimera API-kostnader och möjliggöra återanvändning av leads.
4.  **Exkludering:** Förhindrar bearbetning av befintliga kunder och tidigare nedladdade leads.
