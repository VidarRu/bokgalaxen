# Bokgalaxen – projektplan

Senast uppdaterad 2026-11-14.

## Syfte

Bokgalaxen är en visuell prototyp av den bibliotekariedrivna boktipstjänsten. Böcker är stjärnor i en 3D-rymd. När en bibliotekarie kopplar ihop två böcker, till exempel "läste du den här, prova den där", blir kopplingen ett ljusstråk mellan dem, med en kort motivering. En besökare söker på en bok hen har läst, flyger dit och ser vad bibliotekarierna har kopplat till den.

Prototypen ska visa tjänstens kärna: **det är människors kunskap som syns, inte en algoritms gissningar.** Allt i galaxen har en bibliotekarie lagt dit. Det skiljer den från de LLM-baserade boktipstjänsterna, som bara matchar bokbeskrivningar.

**Galaxen är skyltfönstret, listan är produkten.** Den riktiga tjänsten bygger på listvyn med motiveringar. 3D-galaxen visar idén och väcker intresse, men den är inte det ett bibliotek köper. Säg det rakt ut när prototypen visas, så att ingen tror att produkten *är* galaxen.

**I portfolion blir den ett par med *Inuti språkmodellen*.** Där är galaxen byggd av statistik, och ord hamnar nära varandra för att de används i liknande sammanhang. Här är galaxen byggd av människor, och böcker hamnar nära varandra för att en bibliotekarie har kopplat ihop dem. Samma bildspråk men två helt olika kunskapskällor, och det är i sig en MIK-poäng.

**Målgrupp:** bibliotekarier, som bygger, och biblioteksbesökare, som utforskar. Prototypen visas också för bibliotek som kan tänkas köpa tjänsten.

## Demomanus

Det här ska en besökare eller köpare ha sett efter två minuter. Manuset styr vilka startböcker som väljs och vilket tema som ger synliga kluster.

1. Galaxen öppnas med en guidad startpunkt, en välkänd bok med många kopplingar.
2. Kameran flyger dit. Grannarna lyser upp, och korten visar motiveringar med bibliotekariens signatur.
3. Ett klick på en granne gör den till nytt centrum, och resan fortsätter genom galaxen.
4. En tagg väljs. Böckerna med taggen tänds och resten dämpas.
5. Byggläget: en bibliotekarie kopplar ihop två böcker i formuläret, och ett nytt stråk tänds i galaxen.
6. Förklaringen visas: vad avstånd, storlek och färg betyder.
7. Listvyn visas: samma tips utan 3D, alltså det tjänsten egentligen är.

## Två lägen

| Läge | Vem | Vad man gör |
| --- | --- | --- |
| Bygga | Bibliotekarie | Söker fram böcker i Libris och lägger dem i galaxen. Kopplar ihop två böcker i ett formulär, väljer typ av koppling och skriver en motivering på en eller två meningar. Sätter taggar. Kan ändra och ta bort det hen har lagt in. |
| Utforska | Besökare | Söker en bok hen har läst. Kameran flyger dit, och närmaste grannar visas med bibliotekariernas motiveringar. Man klickar vidare från bok till bok, som en resa genom galaxen. Från varje bok finns en länk till bibliotekets katalog. |

## Vad galaxen visar

| I bilden | Betyder | Källa |
| --- | --- | --- |
| Stjärna | En bok (ett verk, inte en enskild utgåva) | Libris |
| Stjärnans storlek | Hur många kopplingar boken har | Bibliotekarierna |
| Stjärnans färg | Genre, grovt indelat | Bibliotekarien väljer ur en kort lista. Om Libris ämnesord räcker avgörs i steg 1. |
| Ljusstråk | En koppling mellan två böcker, med typ och motivering | Bibliotekarierna |
| Tänd tagg | När en tagg väljs lyser dess böcker och resten dämpas | Bibliotekarierna |
| Avstånd | Böcker med kopplingar dras ihop | Kopplingarna, inte likhet |

En förklaring i bilden säger rakt ut:

- **Avstånd betyder "kopplade av bibliotekarier", inte "liknar varandra".**
- **En bok utan kopplingar har en position som inte betyder något.**
- **Stora stjärnor är böcker som många har kopplat till.** Det gör populära böcker ännu mer synliga, och det är bra att besökaren vet om det.

Det är samma sorts ärlighet som i *Inuti språkmodellen*.

Taggar visas inte som nebulosor. Galaxen placerar böcker efter kopplingar, så böcker med samma tagg kan ligga långt ifrån varandra. Ett moln runt dem skulle bli enormt eller ge en falsk bild av att de hör ihop i rymden.

**Positionerna sparas.** En kraftlayout blir olika vid varje laddning. När layouten har lagt sig sparas positionerna, så att galaxen ser likadan ut nästa gång och laddar snabbare. Nya böcker får plats utan att resten flyttas mer än nödvändigt.

**Typer av kopplingar.** Börja med en kort fast lista, så att stråken kan färgas efter typ. Varje typ har en riktning:

| Typ | Riktning | Så visas den från andra hållet |
| --- | --- | --- |
| samma stämning | båda håll | likadant |
| nästa steg, alltså lite svårare eller djupare | en riktning | "steget före" |
| samma tema, men en annan genre | båda håll | likadant |
| om du gillade berättarrösten | båda håll | likadant |
| för den som läser serien | en riktning | "läs före den här" |

## Användarflöden

**Bibliotekarien bygger.** Byggläget är ett formulär. Galaxen visar resultatet, men man behöver aldrig peka ut en stjärna med musen.

1. Söker på titel, författare eller ISBN. Träffarna hämtas från Libris.
2. Väljer en bok. Finns boken redan i galaxen, även i en annan utgåva, används den befintliga stjärnan. Annars tänds en ny.
3. Väljer "Koppla ihop" och söker fram den andra boken på samma sätt.
4. Väljer typ av koppling, skriver motiveringen och lägger till sin signatur (förnamn och bibliotek). Stråket tänds i galaxen.
5. Kan sätta taggar på böcker, nya eller befintliga.
6. Kan ändra eller ta bort kopplingar och taggar, och ångra det senaste.

**Besökaren utforskar:**

1. Skriver en bok hen har läst.
2. Kameran flyger till stjärnan, och grannarna lyser upp.
3. Ett kort visar varje koppling: omslag, titel, motivering och vem som har skrivit den.
4. Ett klick på en granne gör den till nytt centrum.
5. Länken "Finns på biblioteket?" söker på titel och författare i bibliotekets katalog, så att alla utgåvor kommer med.

**Tom träff.** Med 30–50 böcker hittar de flesta besökare inte sin bok, så det här är det vanligaste läget och ska vara genomtänkt:

- Ett tydligt besked: "Den här boken finns inte i galaxen än."
- Förslag på startböcker som finns i galaxen.
- Knappen "Slumpa en stjärna".
- En rad om att bibliotekarier bygger galaxen och att den växer.

**Listvy.** Allt som syns i 3D finns också som en vanlig lista. Den behövs för tillgängligheten, för svaga datorer och för den som bara vill ha tipsen. Den är också det som visar hur den riktiga tjänsten fungerar.

## Datamodell

Samma modell i prototypen och i den riktiga tjänsten senare. En fil i JSON:

```json
{
  "books": [
    { "id": "uuid", "librisIds": ["…"], "isbns": ["978…", "978…"],
      "title": "…", "author": "…", "year": 2021,
      "genre": "…", "subjects": ["…"], "cover": "url eller null",
      "position": { "x": 0, "y": 0, "z": 0 } }
  ],
  "relationTypes": [
    { "id": "nasta-steg", "name": "nästa steg", "directed": true, "reverseName": "steget före" }
  ],
  "tags": [ { "id": "uuid", "name": "feelgood i skärgården" } ],
  "bookTags": [ { "book": "uuid", "tag": "uuid" } ],
  "relations": [
    { "id": "uuid", "from": "uuid-a", "to": "uuid-b", "type": "nasta-steg",
      "motivation": "…", "signature": "Vidar, Västerviks bibliotek",
      "created": "2026-11-14", "updated": "2026-11-14" }
  ]
}
```

**Bok betyder verk.** Ett Libris-id pekar på en utgåva. Pocketen och den inbundna boken är olika poster, men i galaxen ska de vara samma stjärna. Därför:

- Varje bok har ett eget id (uuid). Libris-id och ISBN sparas som listor.
- När en bok läggs in jämförs titel och författare med böckerna som redan finns. Vid träff läggs den nya utgåvan till den befintliga boken.

**Eget id, inte Libris-id.** Xsearch och Libris XL använder olika id, och KB ska ersätta Xsearch med Libris XL:s API:er. Med ett eget id går data att flytta till en riktig databas, och från Xsearch till XL, utan att kopplingarna måste göras om.

**Alla id slumpas (uuid).** Löpnummer som `r1` krockar när flera bibliotekariers filer slås ihop.

## Teknik

- **Visualisering:** [3d-force-graph](https://github.com/vasturiano/3d-force-graph), som bygger på Three.js och har MIT-licens. Det sköter placeringen av noder och kanter i 3D. Glöd, tända taggar och kameraflygningar läggs till med Three.js. Bygg bildspråket så att det liknar *Inuti språkmodellen*, men gör det inte beroende av den koden.
- **Bokdata:** Libris XL:s API:er provas först i spiken, eftersom KB ska ersätta Xsearch med dem. [Xsearch](https://libris.kb.se/help/xsearch_eng.jsp?open=tech) fungerar i dag och kan svara i JSON, så det är reserven. Alla anrop till Libris läggs i en egen modul, så att källan går att byta utan att resten av koden ändras.
- **Omslag:** i prototypen visas ett genererat omslag med titel och författare. Det passar bildspråket och undviker frågan om rättigheter. Spiken undersöker om Libris eller Open Library har omslag till svenska böcker, men riktiga omslag läggs bara in om det är klart att de får visas.
- **Lagring i prototypen:** i webbläsaren, med export och import av JSON-filen ovan. En startfil i repot ger galaxen innehåll vid första besöket.
  - **Sammanslagning:** bibliotekarier som bygger exporterar sin fil, och Vidar slår ihop den med startfilen. Funktionen tar bort dubbletter: böcker med samma titel och författare blir en bok, och kopplingar med samma `från + till + typ` blir en koppling.
  - **Påminnelse om export:** webbläsarens lagring kan raderas utan förvarning. Sidan påminner om att exportera när det finns osparade ändringar.
- **Lagring i den riktiga tjänsten (fas 2, inte nu):** en riktig databas med inloggning för bibliotekarier. Valet görs senare, med tanke på att Supabase gratisnivå redan är fullt utnyttjad.
- **Hosting:** Vercel. Om Libris inte går att anropa direkt från webbläsaren läggs en liten serverfunktion på Vercel som mellanhand.

## Startdata

Galaxen är tråkig när den är tom, men den får inte fyllas med AI-genererade kopplingar. Det skulle gå emot hela poängen. I stället:

- Vidar bygger de första 30–50 böckerna och kopplingarna själv, utifrån demomanuset. Välj gärna ett tema så att det syns kluster, och en startbok med många kopplingar.
- En arbetsträff med några kollegor fyller på, och kan samtidigt vara en demo av byggläget.
- **Samtycke:** kollegor som bygger tillfrågas innan deras förnamn och bibliotek hamnar i en publik startfil.
- Startfilen märks som en demo: "Kopplingar gjorda av bibliotekarier på X bibliotek."

## Arbetsordning i Claude Code

Det riskablaste görs först. Fable används bara i steget där det visuella avgörs, och Opus för resten.

1. **Teknisk spik (Opus).** Sök i Libris från webbläsaren och hämta titel, författare, ISBN, ämnesord och eventuella omslag. Prova Libris XL först och Xsearch som reserv. Avgör:
   - om Libris kan anropas direkt eller kräver en serverfunktion på Vercel
   - hur olika utgåvor av samma bok känns igen
   - om ämnesorden räcker för att färga efter genre
   - om någon omslagskälla fungerar för svenska böcker

   Ingen grafik i det här steget.
2. **Datamodell och lagring (Opus).** JSON-modellen med egna id, lagring i webbläsaren, export, import, sammanslagning med dubblettkontroll, påminnelse om export och startfilen.
3. **Galaxen (Fable).** Stjärnor, stråk, tända taggar, glöd, kameraflygningar, sparade positioner och prestanda med några hundra böcker. Det här är det visuellt avgörande steget.
4. **Byggläget (Opus).** Formulär för att söka och koppla ihop böcker, typer med riktning, motivering, signatur, taggar samt ändra, ta bort och ångra. Galaxen visar resultatet.
5. **Utforskaläget (Opus).** Sökning, flygning, kort med motiveringar, att klicka vidare, tom träff, guidad startpunkt och länken till katalogen.
6. **Listvy och finputs (Opus).** Tillgänglighet, mobil och laddning.
7. **Granskning (fristående session).** Funktion, tillgänglighet, att texterna i förklaringen stämmer och att demomanuset går att genomföra.
8. **Publicering.** På Vercel, och sidan länkas från aifolkbildaren.se.

## Krav

- **Människan syns.** Varje koppling visar vem som har gjort den. Galaxen innehåller inga AI-genererade kopplingar eller motiveringar.
- **Ärlig bild.** Förklaringen säger vad avstånd, storlek och färg betyder, och att positionen hos böcker utan kopplingar inte betyder något.
- **Tillgänglighet.** Målet är WCAG 2.1 AA: listvyn, tangentbordsnavigering, ett läge utan rörelse när besökaren har valt minskad rörelse i sina inställningar, och tillräcklig kontrast mot den mörka bakgrunden.
- **Integritet.** Inga uppgifter om besökarna sparas. Signaturer är bara förnamn och bibliotek, och bara med samtycke.
- **Svenska.** All text på sidan är på svenska.

## Öppna frågor

- [x] **Libris i webbläsaren.** Avgjort i steg 1: Libris anropas direkt, ingen serverfunktion behövs. XL först, Xsearch som reserv.
- [x] **Utgåvor.** Avgjort i steg 1: titel plus författare är huvudregeln. XL:s verkskoppling finns inte för alla poster och används som extra ledtråd.
- [ ] **Omslag.** Open Library saknar svenska omslag. Libris XL har bilder för en del utgåvor, men det är inte klart om de får visas. Tills dess används genererade omslag.
- [ ] **Typer av kopplingar.** Är listan ovan rätt? Ska bibliotekarier kunna skapa egna typer?
- [ ] **Länk till katalogen.** Vilken katalog ska länken gå till i demon, Västerviks? Hur blir det när flera bibliotek bygger i samma galax?
- [x] **Vem får bygga i prototypen?** Avgjort 2026-11-15: redaktörer med eget konto (användarnamn och lösenord) som administratören skapar. Var och en ser och ändrar sina egna boktips. Se `docs/VERCEL.md`.
- [ ] **Namn.** Ska prototypen heta *Bokgalaxen*?

## Förslag på kort CLAUDE.md

Lägg den här filen i `docs/PLAN.md` och en kort `CLAUDE.md` i repots rot med ungefär det här:

```markdown
# Bokgalaxen

Visuell prototyp av en bibliotekariedriven boktipstjänst. Böcker är stjärnor, och bibliotekariers kopplingar är ljusstråk. Två lägen: Bygga (bibliotekarie, via formulär) och Utforska (besökare).

## Läs först
- `PROGRESS.md`: var projektet står. Läs den i början av varje session.
- `docs/PLAN.md`: hela planen. Läs bara avsnittet för steget du arbetar med.

## Stack
Vite, 3d-force-graph och Three.js. Bokdata från Libris (XL i första hand, Xsearch som reserv), via en egen modul. Lagring i webbläsaren med export, import och sammanslagning av JSON. Vercel.

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
```

## Källor

- [3d-force-graph (GitHub)](https://github.com/vasturiano/3d-force-graph)
- [Libris Xsearch, dokumentation](https://libris.kb.se/help/xsearch_eng.jsp?open=tech)
- [Libris tekniska tjänster](https://libris.kb.se/help/tech_eng.jsp)
- [Libris XL (GitHub)](https://github.com/libris/librisxl)
- [KB: Nätverk för systembibliotekarier 2025-05-28](https://metadatabyran.kb.se/download/18.44166cc219758175f4133b/1749631852934/N%C3%A4tverk%20f%C3%B6r%20systembibliotekarier%202025-05-28.pdf) – om att Xsearch ska ersättas av Libris XL:s API:er
