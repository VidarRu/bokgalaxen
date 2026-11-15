# Bokgalaxen

Visuell prototyp av en bibliotekariedriven boktipstjänst. Böcker är stjärnor, och bibliotekariers kopplingar är ljusstråk. Två lägen: Bygga (bibliotekarie, via formulär) och Utforska (besökare).

## Läs först
- `PROGRESS.md`: var projektet står. Läs den i början av varje session.
- `docs/PLAN.md`: hela planen. Läs bara avsnittet för steget du arbetar med.

## Stack
Vite, 3d-force-graph och Three.js. Bokdata från Libris (XL i första hand, Xsearch som reserv), via en egen modul. Vercel med serverfunktioner i `api/` och Neon Postgres för konton och den delade galaxen (se `docs/VERCEL.md`). Utan server sparas galaxen i webbläsaren, med export, import och sammanslagning av JSON.

## Regler som alltid gäller
- Inga AI-genererade kopplingar eller motiveringar. Allt innehåll i galaxen kommer från människor.
- Böcker har egna id (uuid). Libris-id och ISBN sparas som listor. En bok är ett verk, inte en utgåva.
- Alla anrop till Libris går genom samma modul.
- Allt som syns i 3D finns också i listvyn.
- All text på sidan är på svenska. Målet är WCAG 2.1 AA.

## Arbetssätt
- Ett steg i taget enligt `docs/PLAN.md`. Ingen grafik innan Libris-anropet fungerar (steg 1).
- Fråga innan du lägger till ett nytt paket eller beroende.
- När ett steg är klart: uppdatera `PROGRESS.md` och committa.
- Vidar är inte utvecklare. Förklara terminalkommandon och Git-steg i klarspråk, ett i taget.

## Kommandon
- `npm run dev`: startar sidan lokalt, med serverfunktionerna och en lokal fil som databas (`.data/`). Lägg till `ADMIN_USERNAME=… ADMIN_PASSWORD=…` före för att kunna logga in.
- `npm test`: kör testerna för datamodell, sammanslagning, Libris-tolkning, behörigheter och serverfunktioner.
- `npm run build`: bygger sidan för publicering.
