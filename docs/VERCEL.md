# Publicera Bokgalaxen på Vercel

Den här guiden tar dig från koden på GitHub till en publicerad sida med inloggning för redaktörer. Du behöver inte kunna programmera. Räkna med ungefär 20 minuter.

## Så hänger det ihop

- **Vercel** visar sidan och kör de små serverfunktionerna i mappen `api/` (inloggning, konton och att spara boktips).
- **Neon** är databasen där konton och boktips sparas. Den kopplas till Vercel med några klick och har en gratisnivå.
- **Libris** anropas direkt från besökarens webbläsare, som förut.

Första gången någon öppnar sidan fylls databasen med böckerna i `public/startgalax.json`. Därefter är det databasen som gäller. Att ändra startfilen påverkar alltså inte en galax som redan finns. Vill du lägga till en fil i efterhand använder du *Galaxfil → Slå ihop med en fil* som administratör.

## 1. Skapa projektet i Vercel

1. Gå till [vercel.com](https://vercel.com) och logga in med ditt GitHub-konto.
2. Klicka på **Add New… → Project**.
3. Välj repot **bokgalaxen** och klicka på **Import**.
4. Vercel känner igen att det är ett Vite-projekt. Ändra ingenting och klicka på **Deploy**.

Den första publiceringen fungerar för besökare, men inloggningen fungerar inte än. Det fixar stegen nedan.

## 2. Koppla på databasen (Neon)

1. Öppna projektet i Vercel och gå till fliken **Storage**.
2. Klicka på **Create Database** och välj **Neon** (Serverless Postgres).
3. Välj den kostnadsfria planen och en region nära Sverige, till exempel *Frankfurt* eller *Stockholm* om den finns.
4. Koppla databasen till projektet. Vercel lägger då själv in miljövariabeln `DATABASE_URL`.

Tabellerna skapas automatiskt första gången sidan används. Du behöver inte göra något i Neon.

## 3. Lägg in tre miljövariabler

Gå till **Settings → Environment Variables** i projektet och lägg in:

| Namn | Värde | Vad den gör |
| --- | --- | --- |
| `SESSION_SECRET` | En lång slumpmässig text, minst 32 tecken | Låser inloggningskakorna så att ingen kan förfalska dem. Hitta inte på den själv, utan använd till exempel en lösenordsgenerator. Visa den aldrig för någon. |
| `ADMIN_USERNAME` | Ditt användarnamn, till exempel `vidar` | Användarnamnet för det första kontot, administratören. |
| `ADMIN_PASSWORD` | Ditt lösenord | Lösenordet för det första kontot. Minst 6 tecken, med stor och liten bokstav, en siffra och ett specialtecken. |

Bocka i alla tre miljöerna (Production, Preview, Development) och spara.

## 4. Publicera igen

Miljövariablerna gäller först efter nästa publicering. Gå till fliken **Deployments**, klicka på de tre prickarna vid den senaste och välj **Redeploy**.

## 5. Logga in första gången

1. Öppna sidan och klicka på **Bygga**.
2. Logga in med `ADMIN_USERNAME` och `ADMIN_PASSWORD`. Kontot skapas när du loggar in första gången. Det fungerar bara så länge det inte finns några konton alls.
3. Klart. Nu är du administratör.

Efter det kan du ta bort `ADMIN_PASSWORD` i Vercel om du vill. Kontot finns kvar i databasen, och lösenordet byter du under **Ditt konto**.

## Lägga till en redaktör

När någon klickar på **Begär att bli redaktör** får du ett mejl. Då gör du så här:

1. Logga in och klicka på **Redaktörer** högst upp i byggläget.
2. Skriv ett användarnamn och ett lösenord och klicka på **Skapa kontot**.
3. Skicka användarnamnet och lösenordet till redaktören, helst på två olika sätt (till exempel mejl och sms). Redaktören kan byta lösenord under **Ditt konto**.

Där kan du också ge någon ett nytt lösenord eller ta bort ett konto. Boktips från ett borttaget konto finns kvar, men därefter kan bara administratören ändra dem.

## Vem får göra vad

| | Besökare | Redaktör | Administratör |
| --- | --- | --- | --- |
| Se galaxen och allas boktips | ja | ja | ja |
| Lägga till böcker från Libris och sätta taggar | | ja | ja |
| Skriva, ändra och ta bort boktips | | bara sina egna | allas |
| Byta genre och ta bort en bok | | bara böcker man själv har lagt till, utan andras boktips | alla |
| Byta namn på taggar, ta bort en tagg från alla böcker | | | ja |
| Skapa och ta bort konton | | | ja |
| Importera galaxfiler | | | ja |

Boktipsen från Goodreads-importen har ingen ägare, så bara administratören kan ändra dem.

## Om något går fel

- **"Servern saknar SESSION_SECRET"**: miljövariabeln saknas eller är kortare än 16 tecken. Lägg in den och publicera igen (steg 3 och 4).
- **Inloggningen fungerar inte första gången**: kontrollera att `ADMIN_USERNAME` och `ADMIN_PASSWORD` är inlagda och att du har publicerat igen efteråt. Stora och små bokstäver i lösenordet räknas.
- **"För många felaktiga försök"**: kontot är låst i 15 minuter efter 8 felaktiga lösenord.
- **Sidan visar galaxen men byggläget saknar inloggning**: då når sidan inte serverfunktionerna, och galaxen sparas bara i webbläsaren (som i den gamla prototypen). Kontrollera att publiceringen lyckades under **Deployments**.

## Köra med inloggning på din egen dator

`npm run dev` kör serverfunktionerna lokalt och sparar allt i mappen `.data/` i stället för i Neon. Starta så här för att få ett administratörskonto:

```bash
ADMIN_USERNAME=vidar ADMIN_PASSWORD='Hemligt!1' npm run dev
```

`npm run preview` (den byggda sidan utan serverfunktioner) fungerar som den gamla prototypen, utan inloggning.
