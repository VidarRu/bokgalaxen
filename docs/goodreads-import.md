# Import från Goodreads

Skapad av `scripts/goodreads/import.mjs` 2026-11-15. Kör skriptet igen för att göra om den.

## Siffror

- Böcker i exporten: 417
- Hittade på svenska i Libris: 290 (via ISBN 32, via titel 223, bland författarens svenska böcker 1, osäkra 6, via rättelse 28)
- Samma verk två gånger i exporten (blev en stjärna): 26
- Stjärnor i galaxen: 387
- Inlagda på engelska (finns inte på svenska): 123, varav 103 med uppgifter från en engelsk utgåva i Libris och 20 bara med uppgifter från Goodreads
- Genre för engelska böcker: från författarens andra böcker 19, från serien 8, saknas fortfarande 0
- Genre rättad för hand: 36
- Gick inte att lägga in: 0
- Hoppades över med flit: 4

Kopplingar: 431 (samma betyg 282, serier 149). Betygen 1 och 2 ger inga kopplingar, eftersom galaxen tipsar om böcker.

Genrer (från Libris förslag):

- Roman: 137
- Fantasy och science fiction: 122
- Barn och unga: 50
- Serier: 34
- Fakta: 22
- Deckare och spänning: 11
- Lyrik och dramatik: 8
- Biografi och memoar: 3

## Osäkra träffar, titta på dem först

Samma författare och liknande titel, men inte samma. Är något fel, lägg en rättelse i `scripts/goodreads/rattelser.json`.

| Goodreads | Svensk titel | Författare | Goodreads-id |
| --- | --- | --- | --- |
| The Dunning-Kruger Effect | Dunning-Kruger-effekten | Andrés Stoopendaal | 199797991 |
| Douglas Adams' Starship Titanic | Douglas Adams Stjärnskeppet Titanic | Terry Jones | 15317208 |
| Polgara the Sorceress (Malloreon) | Polgara besvärjerskan | David Eddings | 18884 |
| The Count of Monte Cristo | Greven av Monte-Cristo | Alexandre Dumas | 7126 |
| The Ultimate Hitchhiker’s Guide to the Galaxy | Liftarens guide till galaxen | Douglas Adams | 13 |
| The Walking Dead, Vol. 1: Days Gone Bye | The walking dead | Robert Kirkman | 138398 |

## Översatta titlar att titta på

Engelsk titel på Goodreads, svensk titel från Libris. Är något fel, lägg en rättelse i `scripts/goodreads/rattelser.json`.

| Goodreads | Svensk titel | Författare |
| --- | --- | --- |
| Trofé | Trofé | Gaea Schoeters |
| The Andromeda Strain | Döden från rymden | Michael Crichton |
| Sin City: El duro adiós, primera parte | Sin city | Frank Miller |
| The Road to Wigan Pier | Vägen till Wigan Pier | George Orwell |
| The Holocaust: An Unfinished History | Förintelsen | Dan Stone |
| Flesh | Kött | David Szalay |
| Crook Manifesto | Skurkmanifestet | Colson Whitehead |
| The Man in the High Castle | Mannen i det höga slottet | Philip K. Dick |
| My Idea of Fun | Min grej | Will Self |
| The Nickel Boys | Nickelpojkarna | Colson Whitehead |
| Harlem Shuffle | Harlem shuffle | Colson Whitehead |
| Papillon | Räddningens öar | Henri Charrière |
| Nexus: A Brief History of Information Networks from the Stone Age to AI | Nexus | Yuval N. Harari |
| Collapse: How Societies Choose to Fail or Succeed | Undergång | Jared Diamond |
| Guns, Germs, and Steel: The Fates of Human Societies | Vete, vapen & virus | Jared Diamond |
| Lanzarote | Lanzarote | Michel Houellebecq |
| Platform | Plattform | Michel Houellebecq |
| Serotonin | Serotonin | Michel Houellebecq |
| Unge Mungo | Unge Mungo | Douglas Stuart |
| The Wager: A Tale of Shipwreck, Mutiny and Murder | Wager | David Grann |
| Theft | Stöld | Abdulrazak Gurnah |
| The One Tree | Den andra krönikan om Thomas Covenant, den klentrogne | Stephen Donaldson |
| The Wounded Land | Den andra krönikan om Thomas Covenant, den klentrogne | Stephen Donaldson |
| The Power That Preserves | Krönikorna om Thomas Covenant, den klentrogne | Stephen Donaldson |
| The Illearth War | Krönikorna om Thomas Covenant, den klentrogne | Stephen Donaldson |
| Lord Foul's Bane | Krönikorna om Thomas Covenant, den klentrogne | Stephen Donaldson |
| White Gold Wielder | Den andra krönikan om Thomas Covenant, den klentrogne | Stephen Donaldson |
| The Talismans of Shannara | Shannaras talismaner | Terry Brooks |
| The Elf Queen of Shannara | Arvet från Shannara | Terry Brooks |
| The Druid of Shannara | Shannaras druid | Terry Brooks |
| The Scions of Shannara | Arvet från Shannara | Terry Brooks |
| The Wishsong of Shannara | Shannaras önskesång | Terry Brooks |
| The Elfstones of Shannara | Shannaras alvstenar | Terry Brooks |
| The Sword of Shannara | Shannaras svärd | Terry Brooks |
| The Subtle Knife | Den skarpa eggen | Philip Pullman |
| Harry Potter and the Goblet of Fire | Harry Potter och den flammande bägaren | J. K. Rowling |
| The Tales of Beedle the Bard | Barden Beedles berättelser | J. K. Rowling |
| Harry Potter and the Deathly Hallows | Harry Potter och dödsrelikerna | J. K. Rowling |
| Dr. Jekyll and Mr. Hyde | Dr Jekyll och Mr Hyde | Robert Louis Stevenson |
| Treasure Island | Skattkammarön | Robert Louis Stevenson |
| Dracula | Dracula | Bram Stoker |
| Annihilation | Avgrund | Jeff VanderMeer |
| Interesting Times | Spännande tider | Terry Pratchett |
| The Complete Persepolis | Persepolis | Marjane Satrapi |
| The Way of Kings | Konungars väg | Brandon Sanderson |
| Coraline | Coraline | Neil Gaiman |
| Candide | Candide eller Optimismen | Voltaire |
| Harry Potter and the Order of the Phoenix | Harry Potter och Fenixorden | J. K. Rowling |
| Sword of Destiny | Ödets svärd | Andrzej Sapkowski |
| The Time of Contempt | Föraktets tid | Andrzej Sapkowski |
| Mort | Mort | Terry Pratchett |
| Castle of Wizardry | Sagan om Belgarion | David Eddings |
| Reaper Man | Döden ligger lågt | Terry Pratchett |
| Maus II: A Survivor's Tale: And Here My Troubles Began | Maus | Art Spiegelman |
| The Amber Spyglass | Bärnstenskikaren | Philip Pullman |
| Truckers | Vi far | Terry Pratchett |
| Slaughterhouse-Five | Slakthus 5 | Kurt Vonnegut |
| The Complete Maus | Maus | Art Spiegelman |
| Small Gods | Små gudar | Terry Pratchett |
| Witches Abroad | Häxor i faggorna | Terry Pratchett |
| Men at Arms | En man på sin vakt | Terry Pratchett |
| The Light Fantastic | Det fantastiska ljuset | Terry Pratchett |
| The Last Continent | Den sista kontinenten | Terry Pratchett |
| Hogfather | Svinvinternatt | Terry Pratchett |
| Equal Rites | Trollkarlens stav | Terry Pratchett |
| The Wee Free Men | Små blå män | Terry Pratchett |
| Johnny and the Bomb | Johnny och bomben | Terry Pratchett |
| Diggers | Vi flyr | Terry Pratchett |
| Sourcery | Svartkonster | Terry Pratchett |
| Eric | Eric | Terry Pratchett |
| Johnny and the Dead | Johnny och döden | Terry Pratchett |
| Wings | Vi flyger | Terry Pratchett |
| Only You Can Save Mankind | Bara du kan rädda mänskligheten | Terry Pratchett |
| Good Omens | Goda omen | Terry Pratchett |
| The Amazing Maurice and His Educated Rodents | Den makalöse Maurice och hans kultiverade gnagare | Terry Pratchett |
| Maskerade | Masker | Terry Pratchett |
| Carpe Jugulum | Carpe jugulum | Terry Pratchett |
| Jingo | Jingo | Terry Pratchett |
| Moving Pictures | Rörliga bilder | Terry Pratchett |
| Soul Music | Levande musik | Terry Pratchett |
| Lords and Ladies | Herrskap och häxor | Terry Pratchett |
| Pyramids | Pyramidfeber | Terry Pratchett |
| Feet of Clay | På lerfötter | Terry Pratchett |
| Wyrd Sisters | Häxkonster | Terry Pratchett |
| Guards! Guards! | I lagens namn | Terry Pratchett |
| The Golden Compass | Den mörka materian | Philip Pullman |
| The Sapphire Rose | Sagan om Elenien | David Eddings |
| Never Let Me Go | Never let me go | Kazuo Ishiguro |
| A Game of Thrones | Sagan om is och eld | George R. R. Martin |
| King of the Murgos | Sagan om Mallorea | David Eddings |
| Life of Pi | Berättelsen om Pi | Yann Martel |
| Zodiac | Zodiac | Neal Stephenson |
| The Tower of the Swallow | Svalans torn | Andrzej Sapkowski |
| Caraval | Caraval | Stephanie Garber |
| Pride and Prejudice | Stolthet och fördom | Jane Austen |
| Lolita | Lolita | Vladimir Vladimirovič Nabokov |
| The Adventures of Huckleberry Finn | Huckleberry Finns Äventyr | Mark Twain |
| Catch-22 | Moment 22 | Joseph Heller |
| The Catcher in the Rye | Räddaren i nöden | J. D. Salinger |
| To Kill a Mockingbird | Dödssynden | Harper Lee |
| Flow My Tears, the Policeman Said | Flöda min gråt, sa polisen | Philip K. Dick |
| Heart of Darkness | Mörkrets hjärta | Joseph Conrad |
| Mockingjay | Revolt | Suzanne Collins |
| Red Rising | Rött uppror | Pierce Brown |
| The Da Vinci Code | Da Vinci-koden | Dan Brown |
| So Long, and Thanks for All the Fish | Ajöss och tack för fisken | Douglas Adams |
| The Restaurant at the End of the Universe | Restaurangen vid slutet av universum | Douglas Adams |
| Life, the Universe and Everything | Livet, universum och allting | Douglas Adams |
| The Long Dark Tea-Time of the Soul | Tedags för dystra själar | Douglas Adams |
| Before They Are Hanged | Man bör förlåta | Joe Abercrombie |
| Last Argument of Kings | Det yttersta argumentet | Joe Abercrombie |
| Project Hail Mary | Uppdrag Hail Mary | Andy Weir |
| Artemis | Artemis | Andy Weir |
| Alice's Adventures in Wonderland | Alice i Underlandet | Lewis Carroll |
| Six of Crows | Högt spel | Leigh Bardugo |
| Harry Potter and the Half-Blood Prince | Harry Potter och halvblodsprinsen | J. K. Rowling |
| Golden Son | Gyllene sonen | Pierce Brown |
| All the Light We Cannot See | Ljuset vi inte ser | Anthony Doerr |
| Harry Potter and the Chamber of Secrets | Harry Potter och hemligheternas kammare | J. K. Rowling |
| Catching Fire | Fatta eld | Suzanne Collins |
| The Lion, the Witch and the Wardrobe | Häxan och lejonet | C. S. Lewis |
| The Martian Chronicles | Invasion på Mars | Ray Bradbury |
| Good Omens: The Nice and Accurate Prophecies of Agnes Nutter, Witch | Goda omen | Terry Pratchett |
| Jonathan Strange & Mr Norrell | Jonathan Strange & Mr Norrell | Susanna Clarke |
| The Lord of the Rings | Sagan om ringen | J. R. R. Tolkien |
| The Odyssey | Homeros' Odyssé | Homeros |
| The Road | Vägen | Cormac McCarthy |
| Romeo and Juliet | Romeo och Julia | William Shakespeare |
| Angels & Demons | Änglar och demoner | Dan Brown |
| Persepolis: The Story of a Childhood | Persepolis | Marjane Satrapi |
| The Iliad | Iliaden | Homeros |
| A Clash of Kings | Kungarnas krig | George R. R. Martin |
| Twilight | Om jag kunde drömma | Stephenie Meyer |
| The Secret Garden | Den hemliga trädgården | Frances Hodgson Burnett |
| Stardust | Stjärnstoft | Neil Gaiman |
| Starship Troopers | Stjärnsoldaten | Robert A. Heinlein |
| Pawn of Prophecy | Sagan om Belgarion | David Eddings |
| The Wise Man's Fear | En vis mans fruktan | Patrick Rothfuss |
| The Name of the Wind | Vindens namn | Patrick Rothfuss |
| Harry Potter and the Prisoner of Azkaban | Harry Potter och fången från Azkaban | J. K. Rowling |
| Alice’s Adventures in Wonderland / Through the Looking-Glass | Alice i Underlandet | Lewis Carroll |
| The Phantom of the Opera | Fantomen på Operan | Gaston Leroux |
| The Essential Calvin and Hobbes: A Calvin and Hobbes Treasury | Kalle och Hobbe | Bill Watterson |
| The Graveyard Book | Kyrkogårdsboken | Neil Gaiman |
| The Well of Ascension | Uppstigningens brunn | Brandon Sanderson |
| The Lies of Locke Lamora | Locke Lamoras lögner | Scott Lynch |
| The Eye of the World | Sagan om drakens återkomst | Robert Jordan |
| A Study in Scarlet | En Studie i Rött | Arthur Conan Doyle |
| American Gods | Amerikanska gudar | Neil Gaiman |
| The Ruby Knight | Sagan om Elenien | David Eddings |
| Macbeth: Moment by Moment | Macbeth. Tragedi i fem akter af Shakespeare. Fritt öfversatt af Hinrik Sandström. Uppförd på Djurgårds-theatern första gången den 6 september 1838 | William Shakespeare |
| Rendezvous with Rama | Möte med Rama | Arthur C. Clarke |
| The Three Musketeers | De tre musketörerna | Alexandre Dumas |
| Sorceress of Darshiva | Sagan om Mallorea | David Eddings |
| Belgarath the Sorcerer | Belgarath besvärjaren | David Eddings |
| Magician's Gambit | Sagan om Belgarion | David Eddings |
| Enchanters' End Game | Sagan om Belgarion | David Eddings |
| The Blade Itself | Det lockande stålet | Joe Abercrombie |
| Stranger in a Strange Land | Främling på egen planet | Robert A. Heinlein |
| 300 | 300 | Frank Miller |
| A Midsummer Night’s Dream | En midsommarnattsdröm | William Shakespeare |
| The Hidden City | Sagan om Tamuli | David Eddings |
| The Left Hand of Darkness | Mörkrets vänstra hand | Ursula K. Le Guin |
| The Importance of Being Earnest | Alla gillar Göran | Oscar Wilde |
| A Storm of Swords | Svärdets makt | George R. R. Martin |
| The Handmaid's Tale | Tjänarinnans berättelse | Margaret Atwood |
| Batman: The Dark Knight Returns | Batman | Frank Miller |
| The Moon Is a Harsh Mistress | Revolt mot jorden | Robert A. Heinlein |
| A Feast for Crows | Kråkornas fest | George R. R. Martin |
| The Diamond Throne | Sagan om Elenien | David Eddings |
| Robinson Crusoe | Robinson Crusoe | Daniel Defoe |
| Seeress of Kell | Sagan om Mallorea | David Eddings |
| Guardians of the West | Sagan om Mallorea | David Eddings |
| Domes of Fire | Sagan om Tamuli | David Eddings |
| Childhood’s End | Mot nya världar | Arthur C. Clarke |
| 2001: A Space Odyssey | År 2001 | Arthur C. Clarke |
| The Color of Magic | Magins färg | Terry Pratchett |
| Assassin's Apprentice | Berättelsen om Fjärrskådarna | Robin Hobb |
| Don Quixote | Den tappre och snillrike riddaren don Quixotes af Mancha lefverne och bedrifter; af Miguel de Cervantes Saavedra. Öfversättning ifrån spanska originalet af J.M. Stjernstolpe. Stockholm. Tryckt hos direct. Henrik A. Nordström. På eget förlag. =1-4. 1818-19 | Miguel de Cervantes Saavedra |
| A Wizard of Earthsea | Trollkarlen från Övärlden | Ursula K. Le Guin |
| Mistborn: The Final Empire | Mistborn | Brandon Sanderson |
| The Gunslinger | Det svarta tornet | Stephen King |
| Queen of Sorcery | Sagan om Belgarion | David Eddings |
| The Forever War | Det eviga kriget | Joe Haldeman |
| Neverwhere | Neverwhere | Neil Gaiman |
| The Dark Forest | Den mörka skogen | Cixin Liu |
| Oryx and Crake | Oryx och Crake | Margaret Atwood |
| Twenty Thousand Leagues Under the Sea | En världsomsegling under havet | Jules Verne |
| Mostly Harmless | I stort sett menlös | Douglas Adams |
| Sleeping Giants | Sovande jättar | Sylvain Neuvel |
| Morning Star | Morgonstjärnan | Pierce Brown |
| Ubik | Ubik | Philip K. Dick |
| Klara and the Sun | Klara och solen | Kazuo Ishiguro |
| World War Z: An Oral History of the Zombie War | Världskrig Z | Max Brooks |
| 11/22/63 | 22/11 1963 | Stephen King |
| Roadside Picnic | Picknick vid vägkanten | Arkadij Strugatskij |
| Dirk Gently's Holistic Detective Agency | Dirk Gentlys holistiska detektivbyrå | Douglas Adams |
| The Ballad of Songbirds and Snakes | Balladen om sångfåglar och ormar | Suzanne Collins |
| Count Zero | Count Zero | William Gibson |
| Watchmen | Watchmen | Alan Moore |
| Mona Lisa Overdrive | Mona Lisa overdrive | William Gibson |
| The Three Stigmata of Palmer Eldritch | Marsiansk mardröm | Philip K. Dick |
| Waking Gods | Gudarna vaknar | Sylvain Neuvel |
| Delirium | Delirium | Lauren Oliver |
| Burning Chrome | Johnny Mnemonic | William Gibson |
| Metro 2033 | Metro 2033 | Dmitrij Alekseevič Gluchovskij |
| Sophie’s World | Sofies värld | Jostein Gaarder |
| The Time Machine | Tidsmaskinen | H. G. Wells |
| Solaris | Solaris | Stanislaw Lem |
| A Scanner Darkly | Skannad i dunklet | Philip K. Dick |
| Prelude to Foundation | Preludium till Stiftelsen | Isaac Asimov |
| The Dispossessed: An Ambiguous Utopia | Shevek | Ursula K. Le Guin |
| A Dance with Dragons | Drakarnas dans | George R. R. Martin |
| A Clockwork Orange | En apelsin med urverk | Anthony Burgess |
| Fight Club | Fight Club | Chuck Palahniuk |
| One Flew Over the Cuckoo's Nest | Gökboet | Ken Kesey |
| The Return of the King | Sagan om konungens återkomst | J. R. R. Tolkien |
| The Two Towers | Sagan om de två tornen | J. R. R. Tolkien |
| The Grapes of Wrath | Vredens druvor | John Steinbeck |
| The Hobbit, or There and Back Again | Hobbiten eller Bort och hem igen | John Ronald Reuel Tolkien |
| The Shining Ones | Sagan om Tamuli | David Eddings |
| Demon Lord of Karanda | Sagan om Mallorea | David Eddings |
| Homo Deus: A History of Tomorrow | Homo Deus | Yuval N. Harari |
| I, Robot | Jag, robot | Isaac Asimov |
| Do Androids Dream of Electric Sheep? | Blade runner | Philip K. Dick |
| Foundation | Stiftelsen | Isaac Asimov |
| Ender’s Game | Enders spel | Orson Scott Card |
| Dune | Arrakis - ökenplaneten | Frank Herbert |
| Neuromancer | Neuromancer | William Gibson |
| The Three-Body Problem | Trekropparsproblemet | Cixin Liu |
| Brave New World | Du sköna nya värld | Aldous Huxley |
| Fahrenheit 451 | Fahrenheit 451 | Ray Bradbury |
| The Martian | Ensam på Mars | Andy Weir |
| The Hitchhiker's Guide to the Galaxy | Liftarens guide till galaxen | Douglas Adams |
| It | Det | Stephen King |
| Of Mice and Men | Möss och människor | John Steinbeck |
| Frankenstein | Frankenstein, eller, den moderne Prometheus | Mary Wollstonecraft Shelley |
| Lord of the Flies | Flugornas herre | William Golding |
| The Fellowship of the Ring | Sagan om ringen | J. R. R. Tolkien |
| The Picture of Dorian Gray | Dorian Grays porträtt | Oscar Wilde |
| Animal Farm | Djurfarmen | George Orwell |
| Wuthering Heights | Svindlande höjder | Emily Brontë |
| The Metamorphosis | Förvandlingen | Franz Kafka |
| The Prince | Fursten | Niccolò Machiavelli |
| The Alchemist | Alkemisten | Paulo Coelho |
| Harry Potter and the Philosopher's Stone | Harry Potter och De Vises Sten | J. K. Rowling |
| 1984 | 1984 | George Orwell |
| The Great Gatsby | Den store Gatsby | F. Scott Fitzgerald |
| Maus I: A Survivor's Tale: My Father Bleeds History | Maus | Art Spiegelman |

## Inlagda på engelska

Hittades inte på svenska, så de står på engelska med taggen "Engelsk skönlitteratur" eller "Engelsk facklitteratur". Finns någon ändå på svenska under ett annat namn? Rättelser läggs i `scripts/goodreads/rattelser.json` med Goodreads-id som nyckel, till exempel `{"123": {"title": "Den svenska titeln"}}` eller `{"123": {"skip": true}}`.

| Titel på Goodreads | Författare | Goodreads-id |
| --- | --- | --- |
| Blue Mars (Mars Trilogy, #3) | Kim Stanley Robinson | 77504 |
| The Last Man Takes LSD: Foucault and the End of Revolution | Mitchell Dean | 56430767 |
| Absolute Superman by Geoff Johns & Gary Frank | Geoff Johns | 198139959 |
| Batman: Earth One - The Complete Collection | Geoff Johns | 61268765 |
| The Oath of the Five Lords: The Adventures of Blake and Mortimer Volume 18 | Yves Sente | 19157577 |
| Black Cotton Star | Yves Sente | 43811256 |
| Green Mars (Mars Trilogy, #2) | Kim Stanley Robinson | 77505 |
| Red Mars (Mars Trilogy, #1) | Kim Stanley Robinson | 77507 |
| The Sandman, Vol. 6: Fables & Reflections | Neil Gaiman | 25106 |
| They: A Sequence of Unease | Kay Dick | 1714747 |
| The Marriage of Cadmus and Harmony | Roberto Calasso | 753252 |
| The Rise of the Meritocracy (Classics in Organization and Management Series) | Michael Dunlop Young | 792606 |
| The Great Leveler: Violence and the History of Inequality from the Stone Age to the Twenty-First Century (The Princeton Economic History of the Western World) | Walter Scheidel | 31951505 |
| Once Upon a Time in France | Fabien Nury | 44496606 |
| We Are Legion (We Are Bob) (Bobiverse, #1) | Dennis E. Taylor | 32109569 |
| The Bands of Mourning (Mistborn, #6) | Brandon Sanderson | 18739426 |
| Cibola Burn (The Expanse, #4) | James S.A. Corey | 18656030 |
| Oathbringer (The Stormlight Archive, #3) | Brandon Sanderson | 34002132 |
| Locke & Key, Vol. 6: Alpha & Omega | Joe Hill | 16164271 |
| Shadows of Self (Mistborn, #5) | Brandon Sanderson | 16065004 |
| Gods of Risk (The Expanse, #2.5) | James S.A. Corey | 15837317 |
| Dodger | Terry Pratchett | 13516846 |
| Locke & Key, Vol. 5: Clockworks | Joe Hill | 13490570 |
| Batman: Earth One, Volume 1 | Geoff Johns | 12791521 |
| The Butcher of Anderson Station (The Expanse, #1.5) | James S.A. Corey | 11570653 |
| Words of Radiance (The Stormlight Archive, #2) | Brandon Sanderson | 17332218 |
| Raising Steam (Discworld, #40; Moist von Lipwig, #3) | Terry Pratchett | 11275323 |
| The Alloy of Law (Mistborn, #4) | Brandon Sanderson | 10803121 |
| Locke & Key, Vol. 4: Keys to the Kingdom | Joe Hill | 9674335 |
| Snuff (Discworld, #39; City Watch, #8) | Terry Pratchett | 8785374 |
| I Shall Wear Midnight (Discworld, #38; Tiffany Aching, #4) | Terry Pratchett | 7576115 |
| The Last Wish (The Witcher, #0.5) | Andrzej Sapkowski | 40603587 |
| Monstrous Regiment (Discworld, #31; Industrial Revolution, #3) | Terry Pratchett | 34511 |
| Baptism of Fire (The Witcher, #3) | Andrzej Sapkowski | 18656031 |
| Night Watch (Discworld, #29; City Watch, #6) | Terry Pratchett | 47989 |
| Going Postal (Discworld, #33; Moist von Lipwig, #1) | Terry Pratchett | 64222 |
| The Fifth Elephant (Discworld, #24; City Watch, #5) | Terry Pratchett | 63720 |
| Thud! (Discworld, #34; City Watch, #7) | Terry Pratchett | 62530 |
| Wintersmith (Discworld, #35; Tiffany Aching, #3) | Terry Pratchett | 34492 |
| Making Money (Discworld, #36; Moist Von Lipwig, #2) | Terry Pratchett | 116296 |
| Thief of Time (Discworld, #26; Death, #5) | Terry Pratchett | 48002 |
| Where's My Cow? (Discworld, #34.5) | Terry Pratchett | 34524 |
| Nation | Terry Pratchett | 2424593 |
| The Truth (Discworld, #25; Industrial Revolution, #2) | Terry Pratchett | 288680 |
| The Shepherd's Crown (Discworld, #41; Tiffany Aching, #5) | Terry Pratchett | 22886868 |
| The Last Hero (Discworld, #27; Rincewind, #7) | Terry Pratchett | 34503 |
| Unseen Academicals (Discworld, #37; Rincewind, #8) | Terry Pratchett | 6250169 |
| A Hat Full of Sky (Discworld, #32; Tiffany Aching, #2) | Terry Pratchett | 34501 |
| The Cobweb | Neal Stephenson | 824 |
| Interface | Neal Stephenson | 828 |
| The Minority Report | Philip K. Dick | 581125 |
| Season of Storms (The Witcher, #0.2) | Andrzej Sapkowski | 36099978 |
| Persepolis 2: The Story of a Return (Persepolis, #2) | Marjane Satrapi | 9517 |
| Auberon (The Expanse, #7.5) | James S.A. Corey | 51209450 |
| Strange Dogs (The Expanse, #6.5) | James S.A. Corey | 30367030 |
| The Vital Abyss (The Expanse, #5.5) | James S.A. Corey | 26170028 |
| The Churn (The Expanse, #3.5) | James S.A. Corey | 20981355 |
| Drive (The Expanse, #2.7) | James S.A. Corey | 25899877 |
| Babylon’s Ashes (The Expanse, #6) | James S.A. Corey | 25877663 |
| Caliban’s War (The Expanse, #2) | James S.A. Corey | 12591698 |
| The Aeronaut's Windlass (The Cinder Spires, #1) | Jim Butcher | 136342745 |
| Skin Game (The Dresden Files, #15) | Jim Butcher | 19486421 |
| Restoration of Faith (The Dresden Files, #0.5) | Jim Butcher | 15732549 |
| Cold Days (The Dresden Files, #14) | Jim Butcher | 12216302 |
| Brief Cases (The Dresden Files, #15.5) | Jim Butcher | 12183815 |
| Ghost Story (The Dresden Files, #13) | Jim Butcher | 8058301 |
| Side Jobs (The Dresden Files, #12.5) | Jim Butcher | 7779059 |
| Changes (The Dresden Files, #12) | Jim Butcher | 6585201 |
| Dead Beat (The Dresden Files, #7) | Jim Butcher | 17683 |
| Battle Ground (The Dresden Files, #17) | Jim Butcher | 23106013 |
| The Sandman, Vol. 7: Brief Lives | Neil Gaiman | 25105 |
| Peace Talks (The Dresden Files, #16) | Jim Butcher | 49381341 |
| The Sandman: Overture | Neil Gaiman | 18310944 |
| Locke & Key, Vol. 2: Head Games | Joe Hill | 18652490 |
| Turn Coat (The Dresden Files, #11) | Jim Butcher | 3475161 |
| Locke & Key, Vol. 1: Welcome to Lovecraft | Joe Hill | 3217221 |
| The Hero of Ages (Mistborn, #3) | Brandon Sanderson | 2767793 |
| Small Favor (The Dresden Files, #10) | Jim Butcher | 927979 |
| Blood of Elves (The Witcher, #1) | Andrzej Sapkowski | 6043781 |
| Warbreaker | Brandon Sanderson | 1268479 |
| White Night (The Dresden Files, #9) | Jim Butcher | 91475 |
| The Sandman, Vol. 1: Preludes & Nocturnes | Neil Gaiman | 23754 |
| Summer Knight (The Dresden Files, #4) | Jim Butcher | 91478 |
| Fool Moon (The Dresden Files, #2) | Jim Butcher | 91477 |
| The Sandman, Vol. 5: A Game of You | Neil Gaiman | 25102 |
| Grave Peril (The Dresden Files, #3) | Jim Butcher | 91476 |
| Proven Guilty (The Dresden Files, #8) | Jim Butcher | 91474 |
| Blood Rites (The Dresden Files, #6) | Jim Butcher | 99383 |
| Death Masks (The Dresden Files, #5) | Jim Butcher | 91479 |
| Storm Front (The Dresden Files, #1) | Jim Butcher | 47212 |
| The Sandman, Vol. 8: Worlds' End | Neil Gaiman | 25103 |
| Snow Crash | Neal Stephenson | 61240297 |
| The Sandman: Endless Nights | Neil Gaiman | 47720 |
| V for Vendetta | Alan Moore | 5805 |
| The Sandman, Vol. 9: The Kindly Ones | Neil Gaiman | 71252 |
| Redshirts | John Scalzi | 13055592 |
| Abaddon’s Gate (The Expanse, #3) | James S.A. Corey | 16131032 |
| Consider Phlebas (Culture, #1) | Iain M. Banks | 8935689 |
| Ender's Shadow (The Shadow Series, #1) | Orson Scott Card | 9532 |
| Nemesis Games (The Expanse, #5) | James S.A. Corey | 22886612 |
| The Diamond Age: Or, a Young Lady's Illustrated Primer | Neal Stephenson | 827 |
| The Mote in God's Eye (Moties, #1) | Larry Niven | 100365 |
| Authority (Southern Reach, #2) | Jeff Vandermeer | 18077769 |
| Cryptonomicon | Neal Stephenson | 816 |
| Persepolis Rising (The Expanse, #7) | James S.A. Corey | 28335696 |
| Tiamat's Wrath (The Expanse, #8) | James S.A. Corey | 28335698 |
| Steelheart (The Reckoners, #1) | Brandon Sanderson | 17182126 |
| Acceptance (Southern Reach, #3) | Jeff Vandermeer | 18077752 |
| The City and the Stars | Arthur C. Clarke | 250024 |
| Leviathan Falls (The Expanse, #9) | James S.A. Corey | 28335699 |
| Perdido Street Station (New Crobuzon, #1) | China Miéville | 68494 |
| The Art of War | Sun Tzu | 10534 |
| Leviathan Wakes (The Expanse, #1) | James S.A. Corey | 8855321 |
| Speaker for the Dead (Ender's Saga, #2) | Orson Scott Card | 7967 |
| Death: The High Cost of Living | Neil Gaiman | 16791 |
| Locke & Key, Vol. 3: Crown of Shadows | Joe Hill | 7202841 |
| Elantris (Elantris, #1) | Brandon Sanderson | 68427 |
| The Sandman, Vol. 4: Season of Mists | Neil Gaiman | 25101 |
| The Sandman, Vol. 10: The Wake | Neil Gaiman | 25104 |
| The Sandman, Vol. 3: Dream Country | Neil Gaiman | 25100 |
| The Sandman, Vol. 2: The Doll's House | Neil Gaiman | 25099 |
| Ready Player One (Ready Player One, #1) | Ernest Cline | 9969571 |
| Batman: The Killing Joke | Alan Moore | 96358 |


## Hoppades över

| Titel | Författare | Goodreads-id |
| --- | --- | --- |
| Locke & Key: Welcome to Lovecraft #1 | Joe Hill | 23002051 |
| Sandman. Tom 1. Sen sprawiedliwych | Neil Gaiman | 17255666 |
| V for Vendetta #1 | Alan Moore | 18981933 |
| V de Vendetta, Tomo 1 (V for Vendetta #1 de 2) | Alan Moore | 13625984 |
