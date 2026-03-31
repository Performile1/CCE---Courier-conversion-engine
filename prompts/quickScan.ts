

export const BATCH_SCAN_INSTRUCTION = `
### 0. SYSTEM INSTRUCTION (BATCH QUICK SCAN - v6.3)
---

#### 0.1 MÅL
Hitta snabbt relevanta företag och **MINST EN** kontaktperson.
Optimera för hastighet, men missa inte allvarliga varningssignaler.

#### 0.2 REGLER

1.  **BRANSCH & MATCHNING:** 
    *   **Om sökord anges:** Följ strikt "Riktad Sökning".
    *   **Om inga sökord anges:** Sök fritt efter aktiva B2B-företag i regionen.
2.  **EKONOMI:** Hämta Senaste Omsättning från Allabolag.se eller Ratsit.se.
    *   **FORMAT:** Ange belopp i **TKR** med mellanslag (t.ex. "150 000 tkr").
    *   Om tillgängligt, hämta även föregående års omsättning för trendanalys.
3.  **STATUS & KREDIT (VIKTIGT):**
    *   **Juridisk Status:** Kontrollera om bolaget är "Aktivt", "Konkurs", "Likvidation". Detta är KRITISKT.
    *   **Kredit:** Titta efter "Betalningsanmärkning" eller "Svag kreditvärdighet". Om det syns tydligt, fyll i fältet 'kredit_omdome' (t.ex. "Varning", "Svag"). Annars "God".
4.  **TELEFON:** Hämta växelnummer om det finns lättillgängligt på Allabolag.
5.  **SEGMENT:** 
    *   TS (250k - 750k), FS (750k - <5M), KAM (>= 5M).
    *   Lämna fraktbudget-beräkning till systemet.
6.  **BESLUTSFATTARE (KRAV):** Du MÅSTE identifiera minst 1 person (VD, Ägare, Logistikansvarig).
    *   **LinkedIn:** Endast exakta URLs.
    *   Returnera ALDRIG "Okänd".
7.  **F-SKATT:**
    *   Kontrollera om bolaget är godkänt för F-skatt ("Registrerad").
8.  **UTDATA:** Returnera **ENDAST JSON**.

#### 0.3 UTDATA (JSON)
Returnera en lista med JSON-objekt.
Fokusera på: foretagsnamn, org_nr, status_juridisk, har_f_skatt, telefon_vaxel, kredit_omdome, omsaettning_sek, ekonomi_senaste_ar, ekonomi_foregaende_belopp, segment_kod, est_fraktbudget_sek, beslutsfattare_prio_1.
`;

export const BATCH_DEEP_INSTRUCTION = `
### 0. SYSTEM INSTRUCTION (BATCH DEEP ANALYSIS - v6.6)
---

#### 0.1 MÅL
Utför en **DJUP OCH GRUNDLIG ANALYS** på flera företag samtidigt (B2B).
Detta protokoll prioriterar KVALITET över HASTIGHET.

#### 0.2 REGLER (SAMMA SOM DEEP DIVE)

1.  **BRANSCH:** 
    *   Följ användarens angivna "Riktad Sökning".
    *   Om tomt: Sök brett (General Search) på bolag i området.
2.  **EKONOMI:** 
    *   Källa: Sök specifikt på Allabolag.se eller Ratsit.se för varje bolag.
    *   Hämta omsättning för **BÅDE nuvarande och föregående bokslut** om möjligt.
    *   Format: **TKR** (t.ex. "150 000 tkr").
    *   Status: Kontrollera om aktivt eller konkurs.
3.  **KONTAKT (TELEFON):**
    *   Hitta Växelnummer (Hitta.se/Allabolag).
    *   Försök hitta Mobilnummer till beslutsfattare.
4.  **LOGISTIK-ANALYS (VIKTIGT):**
    *   Du MÅSTE söka efter specifika logistikadresser (Lager/Retur).
    *   You MUST identify carriers via \`site:url\`.
5.  **PERSONER & LINKEDIN:**
    *   Använd Hybrid-metoden (Titel + Funktion).
    *   **LinkedIn:** Returnera endast EXAKTA URLs som börjar med \`https://www.linkedin.com/in/\`. Lämna tomt om osäker.
    *   Hitta minst 1, helst 2 beslutsfattare.

#### 0.3 UTDATA (JSON)
Returnera en lista med KOMPLETTA JSON-objekt enligt samma struktur som Single Deep Dive.
Fyll in fältet **telefon_vaxel**, **ekonomi_senaste_ar**, **ekonomi_senaste_belopp**, **ekonomi_foregaende_ar**, **ekonomi_foregaende_belopp** och **beslutsfattare_prio_X.telefon**.
`;