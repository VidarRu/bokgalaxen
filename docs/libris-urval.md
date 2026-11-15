# Urval från Libris

Skapad av `scripts/libris-urval/urval.mjs` 2026-11-15. Kör skriptet igen för att göra om den. Filen `docs/libris-urval.json` läggs in med **Galaxfil → Slå ihop med en fil**. `public/startgalax.json` är inte ändrad.

## Siffror

- Nya stjärnor: **400** (galaxen har 387, så det blir 787 efter sammanslagningen)
- Kopplingar och motiveringar: 0
- ISBN: 1426 (0 böcker saknar ISBN i de utgåvor som hittades). Libris-id: 1727
- Böcker utan genreförslag från Libris: 0
- Borttagna för att gränsen på 400 nåddes: 8
- Anrop till Libris: 0 nya, 585 från cachen, 0 omförsök

| Urval | Böcker |
| --- | --- |
| Svensk skönlitteratur | 182 |
| Barn- och ungdomsböcker | 173 |
| Augustpris-nominerade | 45 |

| Genre (Libris förslag, också taggen) | Böcker |
| --- | --- |
| Barn och unga | 183 |
| Roman | 97 |
| Deckare och spänning | 46 |
| Lyrik och dramatik | 22 |
| Fantasy och science fiction | 16 |
| Feelgood och romance | 14 |
| Biografi och memoar | 12 |
| Fakta | 6 |
| Serier | 4 |

| Första utgivningsår | Böcker |
| --- | --- |
| 2010 | 11 |
| 2011 | 11 |
| 2012 | 9 |
| 2013 | 12 |
| 2014 | 9 |
| 2015 | 30 |
| 2016 | 31 |
| 2017 | 29 |
| 2018 | 35 |
| 2019 | 39 |
| 2020 | 29 |
| 2021 | 34 |
| 2022 | 31 |
| 2023 | 30 |
| 2024 | 32 |
| 2025 | 28 |

## Så är urvalet gjort

- **Skönlitteratur och barn och unga:** för varje år och genre (se `urval.mjs`) de svenska utgåvor som flest bibliotek har enligt Libris, med högst 2 böcker per författare. Det är ett mått på spridning, inte på kvalitet. Översättningar till svenska ingår.
- **Augustpris:** böckerna står i `scripts/libris-urval/augustpris.json`. **Listan är ofullständig** (47 titlar, 47 funna i Libris). Libris har inget fält för priset, och sidorna på SVT, Sveriges Radio och Wikipedia gick inte att läsa när listan skrevs. Titlarna är de som webbsökning och minne var överens om. Skriptet kontrollerar bara att boken finns på svenska i Libris, inte att nomineringen stämmer. **Granska listan mot augustpriset.se och fyll på**, och kör sedan skriptet igen.
- **Hoppade över:** recensioner, ljudböcker, filmer, böcker *om* en annan bok (Libris-modulens flaggor `isReview`, `isAudio`, `isAboutBook`), böcker utan författare, nyutgåvor av böcker som kom före urvalets första år, och dubbletter.
- **Dubbletter** av böcker som redan finns i `public/startgalax.json` avgörs med `findSameWork`, och dessutom på originaltiteln, så att en svensk utgåva av en bok som ligger där på engelska inte blir en ny stjärna.
- **Ett verk, inte en utgåva:** varje bok har alla ISBN och Libris-id från de utgåvor som hittades (de 25 äldsta svenska utgåvorna av verket). Året är den första svenska utgåvan i Libris, inte nödvändigtvis originalets.
- **Genre** är Libris förslag. Det kan vara fel, till exempel kan en vuxenbok som Libris också märker "ungdom" hamna under Barn och unga. Bibliotekarien kan ändra genren i byggläget.

Avvisade kandidater:

| Orsak | Antal |
| --- | --- |
| fler än 2 böcker av samma författare | 199 |
| redan valt i ett annat urval | 50 |
| nyutgåva av en äldre bok | 34 |
| saknar författare | 20 |
| finns redan i galaxen | 14 |

## Stickprov på 20 böcker

| Titel | Författare | År | Genre | Urval | ISBN | Libris-id |
| --- | --- | --- | --- | --- | --- | --- |
| Till minne av en villkorslös kärlek | Jonas Gardell | 2018 | Roman | Svensk skönlitteratur | 4 | 5 |
| Bara rumpor på stranden | Annika Leone | 2020 | Barn och unga | Barn- och ungdomsböcker | 2 | 2 |
| Värma händer | Katarina Widholm | 2022 | Roman | Svensk skönlitteratur | 4 | 5 |
| Sten i siden | Mikael Niemi | 2023 | Roman | Svensk skönlitteratur | 4 | 5 |
| Min europeiska familj | Karin Bojs | 2015 | Fakta | Augustpris-nominerade | 5 | 6 |
| Äkta amerikanska jeans | Jan Guillou | 2016 | Roman | Svensk skönlitteratur | 1 | 1 |
| Nätter utan gryning | Ninni Schulman | 2025 | Deckare och spänning | Svensk skönlitteratur | 5 | 6 |
| Chop Chop | Linda Bondestam | 2024 | Barn och unga | Augustpris-nominerade | 1 | 1 |
| Vems kompis? | Stina Wirsén | 2010 | Barn och unga | Barn- och ungdomsböcker | 3 | 4 |
| Man lever bara nio gånger | Anja Gatu | 2021 | Barn och unga | Barn- och ungdomsböcker | 2 | 3 |
| Platsa i laget | John Hickman | 2019 | Barn och unga | Barn- och ungdomsböcker | 1 | 2 |
| I varje ögonblick är vi fortfarande vid liv | Tom Malmquist | 2015 | Roman | Svensk skönlitteratur | 6 | 7 |
| Lucia är död | Katarina Wennstam | 2025 | Deckare och spänning | Svensk skönlitteratur | 6 | 7 |
| Jag ser allt du gör | Annika Norlin | 2020 | Roman | Svensk skönlitteratur | 4 | 5 |
| Lisa och Lilly | Mian Lodalen | 2020 | Biografi och memoar | Svensk skönlitteratur | 4 | 5 |
| Ninja Timmy och de stulna skratten | Henrik Tamm | 2013 | Barn och unga | Barn- och ungdomsböcker | 4 | 5 |
| Jordens försvunna skatter | Jens Hansegård | 2013 | Barn och unga | Barn- och ungdomsböcker | 1 | 2 |
| De blodiga händerna | Ingelin Angerborn | 2024 | Barn och unga | Barn- och ungdomsböcker | 3 | 3 |
| Glastronen | Sarah J. Maas | 2016 | Barn och unga | Barn- och ungdomsböcker | 4 | 5 |
| Hej Flugo! | Tedd Arnold | 2014 | Barn och unga | Barn- och ungdomsböcker | 4 | 5 |

## Augustpris-titlar som inte hittades på svenska i Libris

Alla hittades.
