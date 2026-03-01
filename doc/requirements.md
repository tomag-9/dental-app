Požiadavky na evidenčný a fakturačný systém pre zubnú techniku

1. Úvod
   Tento dokument popisuje požiadavky na webovú aplikáciu pre evidenčný a fakturačný systém pre zubnú techniku. Systém má slúžiť na správu pacientov, lekárov, technikov, kliník, prác a cenníka. Aplikácia bude bežať v Dockeri ako kontajnerizovaná webová aplikácia s REST API a responzívnym frontendom.

2. Funkčné požiadavky
   2.1. Evidencia pacientov

Údaje:
Meno
Priezvisko
Rodné číslo (unikátne)
Adresa
Telefón
Email

Funkcionalita:
Vytvorenie, zobrazenie, úprava, vymazanie pacienta.
Zobrazenie histórie prác pre pacienta.

2.2. Evidencia lekárov

Údaje:
Meno
Priezvisko
Titul (pred a za menom)
Kontaktné informácie (telefón, email)

Funkcionalita:
Vytvorenie, zobrazenie, úprava, vymazanie lekára.
Priradenie lekára ku klinike a prácam.

2.3. Evidencia technikov

Údaje:
Meno
Priezvisko
Titul (pred a za menom)
Kontaktné informácie (telefón, email)

Funkcionalita:
Vytvorenie, zobrazenie, úprava, vymazanie technika.
Priradenie technika k prácam.

2.4. Evidencia kliník

Údaje:
Názov
IČO
DIČ
Fakturačné údaje (adresa, bankové spojenie)
Kontaktné informácie (telefón, email)
Zoznam lekárov

Funkcionalita:
Vytvorenie, zobrazenie, úprava, vymazanie kliniky.
Priradenie lekárov ku klinike.

2.5. Evidencia prác

Údaje:
Pacient (väzba na pacienta)
Klinika (väzba na kliniku)
Lekár (väzba na lekára)
Technik (väzba na technika)
Cena
Termín (dátum dokončenia)
Stav (napr. nová, v procese, dokončená)
Zoznam vykonaných úkonov (zoznam kódov z cenníka)

Funkcionalita:
Vytvorenie, zobrazenie, úprava, vymazanie práce.
Automatické priradenie ceny na základe cenníka.
Filtrovanie a vyhľadávanie prác podľa stavu, pacienta, kliniky alebo technika.

2.6. Cenník

Údaje:
Kód úkonu
Názov úkonu
Cena
Platnosť (voliteľné: od-do)

Funkcionalita:
Vytvorenie, zobrazenie, úprava, vymazanie položiek cenníka.
Archivácia starých cien.
Automatické priradenie cien k prácam na základe kódov úkonov.

2.7. Zubná technika (organizácia)

Údaje:
Názov
IČO
DIČ
Fakturačné údaje (adresa, bankové spojenie)
Kontaktné informácie (telefón, email)

Funkcionalita:
Možnosť úpravy údajov o zubnej technike (napr. pre fakturáciu).

2.8. Dodatočné funkcionality (MVP)

Autentifikácia:
Prihlasovanie používateľov (admin, technik, lekár) s rôznymi úrovňami prístupu.
JWT tokeny na zabezpečenie API.

Responzívne UI:
Webové rozhranie prispôsobené pre desktop aj mobil.

Docker:
Kontajnerizácia backendu, frontendu a databázy.
Jednoduché nasadenie pomocou Docker Compose.

3. Nefunkčné požiadavky

Bezpečnosť:
Šifrovanie citlivých údajov (napr. rodné číslo) v databáze.
GDPR súlad (súhlas pacientov, mazanie údajov).

Výkon:
Rýchle načítanie zoznamov (použitie indexov v databáze).
Cachovanie dát pre časté požiadavky (napr. Redis).

Škálovateľnosť:
Podpora viacerých kliník a používateľov.
Možnosť rozšírenia o ďalšie funkcionality (PDF exporty, notifikácie).

4. Technologický stack

Backend: Django, SQLAlchemy, PostgreSQL.
Frontend: React.js, Tailwind
Databáza: PostgreSQL.
Kontajnerizácia: Docker, Docker Compose.
Server: Nginx ako reverzný proxy.

5. Plánované rozšírenia (mimo MVP)

Generovanie PDF (faktúry, protetické štítky).
Notifikácie (e-mail, push) na termíny a stavy prác.
Reporty a štatistiky (príjmy, počet prác, výkon technikov).
Integrácia s účtovnými systémami (export do XML/JSON).
Kalendár na plánovanie prác.

6. Ďalšie poznámky

Prioritou je jednoduché a intuitívne rozhranie pre technikov a lekárov.
Systém musí byť v súlade s GDPR kvôli správe osobných údajov pacientov.
Možnosť budúcej multijazyčnosti (slovenčina, angličtina).
