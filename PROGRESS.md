# Var projektet står

Senast uppdaterad 2026-11-15.

## Klart

- [x] **Steg 1: Teknisk spik.** Libris går att anropa direkt från webbläsaren.
- [x] **Steg 2: Datamodell och lagring.** Egna id, export, import, sammanslagning, påminnelse om export, startfil.
- [x] **Steg 3: Galaxen.** Stjärnor, ljusstråk, tända taggar, glöd, kameraflygningar, sparade positioner.
- [x] **Steg 4: Byggläget.** Sök i Libris, lägg in böcker, koppla ihop dem med typ, riktning, motivering och signatur, sätt taggar, ändra, ta bort och ångra.

- [x] **Mellansteg: import från Goodreads.** Vidars Goodreads-lista är inläst med svenska utgåvor från Libris. Den ligger i `public/startgalax.json` och ersätter testgalaxen. Se avsnittet nedan.

## Nästa steg

**Publicera på Vercel**, så att demon går att visa. Bestäm först vem som får använda byggläget (öppen fråga i `docs/PLAN.md`). Därefter fler lösa stjärnor från Libris och steg 5.

**Steg 5: Utforskaläget.** Körs i en ny session med Opus. Läs avsnitten "Användarflöden" (Besökaren utforskar och Tom träff) och "Arbetsordning" i `docs/PLAN.md`.

Det som redan finns att bygga på:

- `findBooks(galax, fråga)` i `src/data/model.js` söker bland böckerna i galaxen på titel, författare och ISBN. Byggläget använder den, och besökarens sökning kan använda samma.
- Bokkortet i `src/main.js` (`renderCard`) är en enkel första version. Steg 5 bygger ut det: sökning, tom träff, guidad startpunkt och länken till katalogen.
- `el()` och `cover()` ligger i `src/ui/dom.js` och delas av bokkortet och byggläget.
- Läget styrs av `setMode('utforska' | 'bygga')` i `src/main.js`. Adressen `#bygga` öppnar byggläget direkt.

## Importen från Goodreads (2026-11-15)

Ett mellansteg för att få en demo med riktiga böcker. Koden ligger i `scripts/goodreads/` och körs så här:

```
node scripts/goodreads/import.mjs sökväg/till/goodreads_library_export.csv
```

Skriptet skriver om `public/startgalax.json` och `docs/goodreads-import.md`. Svaren från Libris sparas i mappen `.goodreads/` (ligger inte i Git), så en ny körning tar några sekunder.

- **Svenska utgåvor.** Varje bok söks i Libris med språkfiltret svenska, i tre steg: ISBN, sedan efternamn och titel, sedan alla svenska böcker där någon med författarens efternamn medverkar. En översättning känns igen på originaltiteln i Libris (`translationOf`). Libris-modulen har fått två nya val för det: `language` och `familyName`. De klarar bara XL, så då provas inte Xsearch.
- **Resultat:** 417 böcker i exporten, 387 stjärnor. 290 hittades på svenska (vissa blev samma verk, till exempel en svensk samlingsvolym). **123 finns inte på svenska och står på engelska**, med uppgifter från en engelsk utgåva i Libris (103) eller bara från Goodreads (20). Fyra hoppades över med flit (dubbletter på andra språk). Listan står i `docs/goodreads-import.md`.
- **Engelska böcker** får taggen *Engelsk skönlitteratur* (eller *Engelsk facklitteratur*) utöver genren. Libris genreförslag är svagt för engelska utgåvor, så en engelsk bok i en serie får seriens genre, och en bok utan genre får samma genre som författarens andra böcker. Engelska titlar med undertitel jämförs bara på ISBN, eftersom Libris ofta har en för allmän titel (till exempel "The Sandman" för alla tio volymerna).
- **Fel i genreförslaget rättat:** Libris märker facklitteratur "Ej skönlitteratur", och det lästes som roman. Det gällde också byggläget. Nu blir det Fakta (eller Biografi).
- **Rättelser** står i `scripts/goodreads/rattelser.json`: svensk titel för böcker vars titel inte går att räkna ut (klassiker översatta från andra språk, svenska originalböcker som Vidar läst på engelska), genre där Libris förslag var uppenbart fel (till exempel serieromaner), och böcker som hoppas över. Libris måste ändå bekräfta varje titelrättelse.
- **Kopplingar (431)** bygger på det Vidar själv har angett på Goodreads, inte på något påhittat:
  - *Samma betyg på Goodreads* (ny kopplingstyp, 282 stråk): böcker med samma betyg (3–5 stjärnor) och samma genre, kopplade i en ring så att varje bok får två grannar. Alla med alla hade blivit omkring 11 000 stråk. Betyg 1 och 2 ger inga kopplingar, eftersom galaxen tipsar om böcker.
  - *För den som läser serien* (149 stråk): del för del enligt Goodreads serieuppgifter.
  - Alla har signaturen **"Vidar (Goodreads)"**, så att de är lätta att hitta och ta bort när riktiga kopplingar finns.
- **Taggar** är bokens genre, enligt Libris förslag, plus språktaggen för engelska böcker. Inga taggar från Vidars hyllor.
- Skärmbild: `docs/skarmbilder/goodreads-galax.png`.

Att tänka på: undertiteln på sidan säger "Varje ljusstråk har en bibliotekarie dragit". Det stämmer inte helt för importerade kopplingar. Bokkortet visar signaturen och motiveringen, så det framgår där.

## Hur byggläget fungerar (steg 4)

- Knapparna **Utforska | Bygga** längst ner till höger byter läge. Byggläget är ett formulär i en panel till höger (på mobil längst ner). Koden ligger i `src/build/builder.js`.
- **Söka:** en sökning visar först böcker som redan finns i galaxen, sedan träffar från Libris. Träffar från Libris visar år och antal utgåvor, och märks "Finns redan i galaxen" när verket redan är en stjärna. Väljer man en sådan läggs den nya utgåvans ISBN och Libris-id till den befintliga stjärnan.
- **Ny bok:** bibliotekarien väljer genre. Libris förslag är förvalt och står utskrivet ("Libris föreslår Roman. Du väljer.").
- **Bokens sida:** genre, kopplingar (med Ändra och Ta bort), taggar (lägg till, ta bort) och Ta bort boken ur galaxen. Galaxen flyger till boken. Klickar man på en stjärna i byggläget öppnas den bokens sida.
- **Koppla ihop:** sök fram den andra boken, välj typ (med en kort hjälptext per typ), se riktningen i klartext och byt håll med en knapp, skriv motivering (högst 400 tecken) och signatur. Signaturen minns webbläsaren åt bibliotekarien. Saknas motivering eller signatur visas ett fel och markören hamnar i fältet. En koppling som redan finns blir ingen dubblett.
- **Taggar:** under "Alla taggar i galaxen" på startsidan kan en tagg byta namn eller tas bort från alla böcker. Byter man namn till en tagg som redan finns slås de ihop.
- **Ångra:** knappen Ångra överst i panelen, eller Ctrl+Z (Cmd+Z på Mac) utanför textfälten. Upp till 30 steg. Raden "Senaste ändringen: …" säger vad som ångras. Ångra finns bara tills sidan laddas om. Stjärnorna behåller sina platser när man ångrar.
- **Påminnelsen om export** ligger i panelen i byggläget, så att den inte täcker formuläret.
- I byggläget visas alltid den riktiga galaxen, även när den är tom. Testgalaxen syns bara i utforskaläget. Med `?test=` i adressen går byggläget inte att öppna, så att ingen bygger på platshållare.

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

- `npm test`: 21 tester för datamodell, sammanslagning, lagring, ångra, sökning i galaxen och tolkning av Libris-svar (med riktiga svar sparade i `tests/fixtures`).
- Byggläget i en riktig webbläsare mot riktiga Libris (2026-11-14): sök, lägg in en bok, sätt tagg, koppla ihop med en ny bok, fel när motiveringen saknas, byt håll, spara, ändra, ta bort, ångra med knappen och med Ctrl+Z, byta läge med en bok vald, omladdning (galaxen och byggläget finns kvar), mobilstorlek. Inga fel i konsolen.
- I en riktig webbläsare: klick på en stjärna, bokkort, Escape, import, påminnelse om export, export, sparade positioner efter omladdning (ingen stjärna flyttade sig), ny bok utan att resten flyttas, minskad rörelse, mobilstorlek.
- Skärmbilder finns i `docs/skarmbilder/` (steg 3 och steg 4).

## Inte kontrollerat

- Bildhastigheten på en riktig dator eller telefon. Molnmiljön har inget grafikkort. Prova `?test=320` på en vanlig dator och på en mobil.
- Skärmläsare och tangentbordsnavigering i själva 3D-bilden. Det hör till listvyn i steg 6.
- Byggläget med en riktig skärmläsare. Formuläret använder vanliga fält med etiketter, felmeddelanden läses upp och markören flyttas till rubriken när vyn byts, men det är inte provat med NVDA eller VoiceOver.

## Kända brister

- En ny bok som kopplas till en bok mitt i ett tätt kluster kan hamna en bit utanför klustret, med ett långt stråk. "Lägg om galaxen" rättar till det.
- Titlar på mobil kan hamna bakom rubriken. Mobilen finputsas i steg 6.
- **Med bara två eller tre böcker ligger stjärnorna så tätt att stråket knappt syns.** Det märks direkt när de första böckerna byggs (se `docs/skarmbilder/steg4-bok.png`). Avståndet styrs av kraftlayouten från steg 3 (`graph.d3Force('link').distance(34)` i `src/galaxy/galaxy.js`). Det rättar till sig när galaxen växer. Ska det ändras är det ett beslut om bildspråket, inte om byggläget.
- Libris sökning blandar in recensioner och böcker *om* en bok (till exempel "Recension av: Martinson, Harry: Aniara"). Bibliotekarien ser författare och år och väljer rätt, men listan kan bli lång.
- Bibliotekarien kan inte ändra titel eller författare. De kommer från Libris.

## Öppna frågor som är avgjorda

- Libris i webbläsaren: direkt, utan serverfunktion. XL först, Xsearch som reserv.
- Utgåvor: titel och författare, plus XL:s verkskoppling där den finns.
- Omslag: genererade tills rättigheterna är klara.

Övriga öppna frågor står kvar i `docs/PLAN.md`.

## Molnmiljön

Sessioner i Claude Code på webben behöver miljön **bokgalaxen**, som släpper igenom `libris.kb.se` och `openlibrary.org`. Standardmiljön blockerar dem.
