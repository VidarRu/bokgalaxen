# Var projektet står

Senast uppdaterad 2026-11-14.

## Klart

- [x] **Steg 1: Teknisk spik.** Libris går att anropa direkt från webbläsaren.
- [x] **Steg 2: Datamodell och lagring.** Egna id, export, import, sammanslagning, påminnelse om export, startfil.
- [x] **Steg 3: Galaxen.** Stjärnor, ljusstråk, tända taggar, glöd, kameraflygningar, sparade positioner.

## Nästa steg

**Steg 4: Byggläget.** Körs i en ny session med Opus. Läs avsnitten "Användarflöden" och "Arbetsordning" i `docs/PLAN.md`.

Det som redan finns att bygga på:

- `searchBooks(fråga)` i `src/libris/index.js` ger träffar som går rakt in i `addBook()` i `src/data/model.js`. Fältet `suggestedGenre` är Libris förslag på genre. Bibliotekarien väljer.
- `store.update((galax) => nyGalax)` i `src/data/store.js` sparar, markerar att det finns ändringar som inte är exporterade och ritar om galaxen. Nya böcker hamnar nära sina grannar, och resten av galaxen ligger still.
- Ångra finns inte än. Enklast är att spara föregående galax i `store.update` och lägga till `store.undo()`.
- Bokkortet i `src/main.js` är en enkel första version. Steg 5 bygger ut det (sökning, tom träff, guidad startpunkt, länk till katalogen).

## Vad spiken visade (steg 1)

| Fråga | Svar |
| --- | --- |
| Kan Libris anropas direkt från webbläsaren? | Ja, både Libris XL (`libris.kb.se/find.jsonld`) och Xsearch tillåter det. Ingen serverfunktion behövs. Kontrollerat med en riktig webbläsare 2026-11-14. |
| XL eller Xsearch? | XL i första hand, Xsearch som reserv om XL inte svarar inom 12 sekunder. XL ger ämnesord, genre och verkskoppling. Xsearch ger bara titel, författare, år och ISBN. |
| Hur känns utgåvor av samma bok igen? | XL har en verkskoppling, men inte för alla poster (talböcker saknar den ofta). Därför används titel och författare som huvudregel, med ISBN, Libris-id och XL:s verk-id som extra ledtrådar. Verk-id sparas i det nya fältet `librisWorkIds`. |
| Räcker ämnesorden för att färga efter genre? | Delvis. Genre/form-termer och SAB-klassning ger ett bra förslag för deckare, lyrik, barnböcker och romaner, men "feelgood" finns till exempel inte. Libris föreslår, bibliotekarien väljer ur den korta listan i `src/data/genres.js`. |
| Finns en omslagskälla? | Nej, ingen som går att använda nu. Open Library saknar omslag för de svenska böcker som provades. Libris XL har omslagsbilder för en del utgåvor, men rättigheterna är inte klarlagda. Genererade omslag används. |

Att tänka på: XL svarar med ungefär 80 kB per träff (komprimerat cirka 10 kB), så sökningen hämtar högst 12 utgåvor åt gången. Sökningen blandar ibland in filmer och översättningar. Det får byggläget hantera, till exempel genom att visa år och antal utgåvor.

## Hur galaxen är byggd (steg 3)

- `src/galaxy/galaxy.js` är navet. 3d-force-graph sköter placering, kamera och klick. Det som syns ritas av egna lager: `stars.js` (stjärnor), `links.js` (ljusstråk), `backdrop.js` (bakgrund) och `labels.js` (titlar). Alla stjärnor ritas i ett anrop till grafikkortet och alla stråk i ett annat.
- **Riktning** syns på två sätt: stråket ljusnar mot boken det leder till, och ljuset vandrar ditåt. Med minskad rörelse finns ljusningen kvar.
- **Tänd tagg** visas med en ring runt stjärnan, inte bara med ljusstyrka.
- **Sparade positioner:** när layouten har lagt sig sparas positionerna i galaxen. Nästa gång ligger stjärnorna på samma plats direkt. "Lägg om galaxen" i menyn Galaxfil gör om layouten från början.
- **Minskad rörelse:** inga flygningar, ingen drift, inget blinkande. Layouten räknas klart innan något visas.
- Galaxen plattas till en skiva av en svag kraft mot mitten. Avstånden kommer fortfarande bara från kopplingarna.
- Bakgrundsstjärnorna och diset är dekor. Det står i förklaringen.

## Testgalaxen

Startfilen `public/startgalax.json` är tom, eftersom galaxen inte får innehålla påhittade kopplingar. När galaxen är tom visas i stället en testgalax med platshållare ("Testbok 1", signaturen "Testdata") och en tydlig notis. Den sparas aldrig. `?test=320` i adressen visar en testgalax med 320 böcker.

När Vidar har byggt de första böckerna exporteras de och läggs i `public/startgalax.json`. Då försvinner testgalaxen av sig själv.

## Kontrollerat

- `npm test`: 14 tester för datamodell, sammanslagning, lagring och tolkning av Libris-svar (med riktiga svar sparade i `tests/fixtures`).
- I en riktig webbläsare: klick på en stjärna, bokkort, Escape, import, påminnelse om export, export, sparade positioner efter omladdning (ingen stjärna flyttade sig), ny bok utan att resten flyttas, minskad rörelse, mobilstorlek.
- Skärmbilder finns i `docs/skarmbilder/`.

## Inte kontrollerat

- Bildhastigheten på en riktig dator eller telefon. Molnmiljön har inget grafikkort. Prova `?test=320` på en vanlig dator och på en mobil.
- Skärmläsare och tangentbordsnavigering i själva 3D-bilden. Det hör till listvyn i steg 6.

## Kända brister

- En ny bok som kopplas till en bok mitt i ett tätt kluster kan hamna en bit utanför klustret, med ett långt stråk. "Lägg om galaxen" rättar till det.
- Titlar på mobil kan hamna bakom rubriken. Mobilen finputsas i steg 6.

## Öppna frågor som är avgjorda

- Libris i webbläsaren: direkt, utan serverfunktion. XL först, Xsearch som reserv.
- Utgåvor: titel och författare, plus XL:s verkskoppling där den finns.
- Omslag: genererade tills rättigheterna är klara.

Övriga öppna frågor står kvar i `docs/PLAN.md`.

## Molnmiljön

Sessioner i Claude Code på webben behöver miljön **bokgalaxen**, som släpper igenom `libris.kb.se` och `openlibrary.org`. Standardmiljön blockerar dem.
