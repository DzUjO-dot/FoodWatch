# FoodWatch – PWA do zarządzania domową spiżarnią

FoodWatch to progresywna aplikacja webowa (PWA), która pomaga kontrolować domową spiżarnię:
daty ważności produktów, ich lokalizacje na półkach oraz listę zakupów.  
Aplikacja działa offline, wykorzystuje kamerę do skanowania kodów kreskowych, powiadomienia
o kończącej się dacie ważności oraz geolokalizację do wyszukiwania sklepów w pobliżu.

---

## Spis treści

1. [Główne funkcje](#główne-funkcje)  
2. [Stack technologiczny](#stack-technologiczny)  
3. [Struktura projektu](#struktura-projektu)  
4. [Jak uruchomić projekt lokalnie](#jak-uruchomić-projekt-lokalnie)  
   - [Opcja 1: VS Code + Live Server](#opcja-1-vs-code--live-server)  
   - [Opcja 2: Node + npx serve](#opcja-2-node--npx-serve)  
   - [Opcja 3: Python http.server](#opcja-3-python-httpserver)  
5. [Jak postawić aplikację na hostingu](#jak-postawić-aplikację-na-hostingu)  
   - [Netlify](#netlify)  
   - [Surge](#surge)  
6. [Instalacja jako PWA](#instalacja-jako-pwa)  
7. [Opis widoków i flow](#opis-widoków-i-flow)  
8. [Natywne funkcje urządzenia](#natywne-funkcje-urządzenia)  
9. [IndexedDB – model danych](#indexeddb--model-danych)  
10. [Service Worker i strategia cache](#service-worker-i-strategia-cache)  
11. [Powiadomienia o ważności](#powiadomienia-o-ważności)  
12. [Pseudo-„AI” koszyka i statystyki](#pseudo-ai-koszyka-i-statystyki)  
13. [Kryteria projektowe a implementacja](#kryteria-projektowe-a-implementacja)  
14. [Jak testować funkcje aplikacji](#jak-testować-funkcje-aplikacji)  
15. [Pomysły na rozwój](#pomysły-na-rozwój)

---

## Główne funkcje

- **Dashboard**
  - Liczba produktów w spiżarni.
  - Produkty z kończącym się terminem (≤ X dni, ustawiane w Ustawieniach).
  - Produkty przeterminowane.
  - „Wskaźnik ryzyka” – procent produktów wymagających uwagi.
  - Ostatnie alerty o ważności (max 5) z historii alertów.

- **Spiżarnia**
  - Lista wszystkich produktów z datami ważności, ilością i lokalizacją (np. `A1`, `E3`, `Lodówka`).
  - Filtry: lokalizacja, wyszukiwarka po nazwie/marki, sortowanie (data, nazwa, lokalizacja).
  - Akcje:
    - *Zużyj 1* – zmniejsza ilość produktu, przy 0 przenosi na listę zakupów.
    - *Edytuj* – przełącza w tryb edycji na ekranie skanera.
    - *Usuń* – usuwa produkt.
    - *Do zakupów* – przenosi produkt na listę zakupów.

- **Skaner / Dodawanie**
  - Skanowanie kodów kreskowych za pomocą kamery (`getUserMedia` + `BarcodeDetector`, jeśli dostępny).
  - Wyszukiwanie produktu po **kodzie kreskowym** w OpenFoodFacts.
  - Wyszukiwanie produktu po **nazwie** w OpenFoodFacts (debouncing, komunikat „Wyszukiwanie…”).
  - Formularz ręcznego dodawania / edycji produktu (nazwa, marka, data ważności, ilość, lokalizacja).

- **Lista zakupów**
  - Sekcja *Do kupienia* – produkty:
    - dodane ręcznie,
    - przeniesione z przeterminowania,
    - przeniesione po wyzerowaniu ilości.
  - Sekcja *Kupione (ostatnie 7 dni)* – używana przez pseudo-„AI” koszyka.
  - Oznaczanie produktu jako *Kupione* + zapisywanie daty zakupu.
  - Udostępnianie listy (Web Share API / schowek / fallback alert).
  - „Sklepy w pobliżu” – wykorzystanie geolokalizacji + Google Maps.
  - Czyszczenie wszystkich pozycji oznaczonych jako *Kupione*.

- **Historia działań**
  - Max **15** najnowszych wpisów:
    - dodawanie/edycja/usuwanie produktów,
    - zużywanie produktów,
    - przenoszenie na listę zakupów,
    - operacje w liście zakupów,
    - eksport danych itd.
  - Dane przechowywane lokalnie w IndexedDB.

- **Statystyki**
  - „Zero waste score” – procent produktów wykorzystanych vs. przeterminowanych.
  - Statystyki miesięczne: ile produktów dodano / zużyto / przeterminowało się w bieżącym miesiącu.
  - Najczęściej marnowane kategorie produktów.
  - Lista prostych pomysłów na wykorzystanie produktów z kończącym się terminem (przepisy wg kategorii).

- **Ustawienia**
  - Powiadomienia:
    - o produktach przeterminowanych,
    - o produktach z kończącą się datą,
    - próg „wkrótce” w dniach (1–14),
    - interwał automatycznych sprawdzeń (w godzinach).
  - Motyw interfejsu:
    - `auto` (wg systemu), `light`, `dark`.
  - Presety lokalizacji półek (np. `A1;A2;Lodówka;Zamrażarka`) używane w podpowiedziach.

---

## Stack technologiczny

- **HTML5** – semantyczna struktura, kilka głównych widoków w jednym SPA.
- **CSS3** (`css/styles.css`):
  - Motyw jasny/ciemny z fioletowymi akcentami.
  - „Glassmorphism”, zaokrąglone karty, responsywny grid, mobile-first.
- **Vanilla JavaScript (ES6+)**
  - `js/app.js` – główna logika aplikacji.
  - `js/db.js` – warstwa dostępu do IndexedDB.
  - `js/scanner.js` – kamera + skanowanie kodów.
  - `js/notifications.js` – powiadomienia + historia alertów.
  - `js/aiPriceAgent.js` – pseudo-„AI” (kategorie + szacowanie kosztów).
- **PWA**
  - `manifest.webmanifest` – konfiguracja PWA (nazwy, ikony, kolory).
  - `sw.js` – Service Worker, Cache API, obsługa trybu offline.
- **Web APIs**
  - `MediaDevices`, `BarcodeDetector` (jeśli wspierany),  
  - `Notification`, `ServiceWorkerRegistration.showNotification`,  
  - `Geolocation`,  
  - `IndexedDB`,  
  - `localStorage`.

---

## Struktura projektu

```text
.
├── index.html
├── manifest.webmanifest
├── sw.js
├── css
│   └── styles.css
├── js
│   ├── app.js
│   ├── db.js
│   ├── scanner.js
│   ├── notifications.js
│   └── aiPriceAgent.js
├── img
│   ├── foodwatch-icon-192.png
│   ├── foodwatch-icon-512.png
│   └── foodwatch-favicon-32.png
└── README.md
```

---

## Jak uruchomić projekt lokalnie

> **Ważne:**  
> Service Worker i część API (np. powiadomienia) działają **tylko z serwera HTTP/HTTPS**,  
> nie z pliku `file://`. Dlatego zawsze uruchamiaj aplikację przez prosty serwer.

### Opcja 1: VS Code + Live Server

1. Otwórz folder projektu w VS Code.
2. Zainstaluj rozszerzenie **Live Server** (Ritwick Dey).
3. W eksploratorze kliknij prawym na `index.html` → **Open with Live Server**.
4. W przeglądarce otworzy się adres, np. `http://127.0.0.1:5500/`.
5. Tam testujesz:
   - PWA,
   - Service Workera,
   - powiadomienia,
   - kamerę, geolokalizację itd.

### Opcja 2: Node + npx serve

1. W katalogu projektu:

   ```bash
   npm install -g serve
   ```

2. Uruchom serwer:

   ```bash
   serve .
   # lub
   npx serve .
   ```

3. Wejdź w przeglądarce na adres wyświetlony w konsoli, np.  
   `http://localhost:3000` lub `http://localhost:5000`.

### Opcja 3: Python http.server

Jeśli masz Pythona:

- **Python 3:**

  ```bash
  python -m http.server 8000
  ```

- **Python 2:**

  ```bash
  python -m SimpleHTTPServer 8000
  ```

Następnie otwórz w przeglądarce:  
`http://localhost:8000`

---

## Jak postawić aplikację na hostingu

Aplikacja jest **statyczna** (HTML/CSS/JS), więc idealnie pasuje na hosting typu Netlify / Surge.

### Netlify

1. Załóż konto na [Netlify](https://www.netlify.com/).
2. W panelu wybierz: **New site from Git**.
3. Połącz repozytorium z GitHuba.
4. W ustawieniach:
   - **Build command:** zostaw puste (nie ma bundlera),
   - **Publish directory:** `.` (root katalog).
5. Po deployu aplikacja będzie dostępna pod adresem `https://twoja-nazwa.netlify.app/` (HTTPS!).

### Surge

1. Zainstaluj Surge:

   ```bash
   npm install -g surge
   ```

2. W katalogu projektu:

   ```bash
   surge .
   ```

3. Podaj email, hasło i nazwę domeny, np. `foodwatch-pwa.surge.sh`.

---

## Instalacja jako PWA

### Desktop (Chrome / Edge)

1. Wejdź na działającą wersję aplikacji (localhost lub hosting).
2. W pasku adresu pojawi się ikonka „Instaluj aplikację”.
3. Kliknij ją i potwierdź instalację.
4. Aplikacja pojawi się jako osobna pozycja w menu Start / liście aplikacji.

### Android (Chrome)

1. Otwórz aplikację w przeglądarce.
2. Po chwili powinna pojawić się belka „Dodaj do ekranu głównego” albo opcja w menu `⋮` → **Dodaj do ekranu głównego**.
3. Potwierdź.  
   Na ekranie głównym pojawi się ikonka wykorzystująca `foodwatch-icon-192.png`.

---

## Opis widoków i flow

### Dashboard

- Startowy widok.
- Pokazuje:
  - liczbę produktów,
  - produkty z kończącym się terminem,
  - przeterminowane,
  - wskaźnik ryzyka,
  - ostatnie alerty o ważności (max 5, z `notifications.js`).
- Przycisk **Odśwież** → `refreshAll()`.

### Spiżarnia

- Lista produktów z:
  - nazwą, marką, lokalizacją,
  - datą ważności,
  - ilością,
  - statusem (`OK`, `kończy się wkrótce`, `przeterminowany` – funkcja `expiryStatus`).
- Filtry:
  - lokalizacja,
  - wyszukiwarka tekstowa,
  - sortowanie.
- Akcje per produkt:
  - *Zużyj 1*,
  - *Edytuj*,
  - *Usuń*,
  - *Do zakupów*.

### Skaner / Dodawanie

- Kontener z video + 2 przyciski:
  - **Uruchom skaner** – próbuje odpalić kamerę,
  - **Zatrzymaj skaner** – zatrzymuje stream.
- Wspierane urządzenia używają `BarcodeDetector`; w przeciwnym razie można wpisać kod ręcznie.
- **Wyszukiwarka OpenFoodFacts po nazwie**:
  - input z debouncingiem (500 ms),
  - komunikaty: „Wpisujesz…”, „Wyszukiwanie…”, „Brak wyników…”.
- Kliknięcie w wynik uzupełnia formularz (nazwa, marka, kod).
- Formularz zapisuje/edytuje produkt, zapisuje log do historii i wraca do widoku Spiżarnia.

### Lista zakupów

- Dane z tabeli `shopping` w IndexedDB.
- **Do kupienia**:
  - listowane wszystkie pozycje o `status !== 'bought'`,
  - akcje: **Kupione**, **Usuń**.
- **Kupione (ostatnie 7 dni)**:
  - pozycje o `status === 'bought'` i `boughtAt` w ostatnich 7 dni.
- **Pseudo-„AI”**:
  - na podstawie kupionych produktów z 7 dni wylicza:
    - sumę szacunkowych kosztów,
    - rozbicie na kategorie z emoji.
- Dodatkowe akcje:
  - Udostępnij (Web Share API / schowek),
  - Sklepy w pobliżu (geolokalizacja),
  - Usuń wszystkie kupione.

### Historia działań

- `PantryDB.getHistory(15)` – max 15 najnowszych wpisów.
- Każde zdarzenie (dodanie, edycja, usunięcie produktu, zużycie, przeniesienie, operacje na liście zakupów, eksport danych) zapisuje wpis w historii.
- Dostępny przycisk **Eksportuj dane do JSON**.

### Statystyki

- `Zero waste score`:
  - liczone jako:
    - zużyte (`PRODUCT_USED_ONE`, `PRODUCT_FINISHED_TO_SHOPPING`) vs.
    - przeterminowane (`PRODUCT_EXPIRED_TO_SHOPPING`).
- „Ten miesiąc”:
  - ile produktów dodano / zużyto / przeterminowało się od 1 dnia bieżącego miesiąca.
- Najczęściej marnowane kategorie:
  - na podstawie logów `PRODUCT_EXPIRED_TO_SHOPPING` i mapowania kategorii z `FoodWatchAI`.
- Pomysły na wykorzystanie:
  - dla produktów z kończącym się terminem (status `soon`),
  - w oparciu o kategorię produktu i słownik `IDEAS_BY_CATEGORY`.

### Ustawienia

- Formularz powiązany z obiektem `settings` trzymanym w `localStorage`.
- Pola:
  - przełączniki powiadomień,
  - próg „wkrótce” (dni),
  - interwał automatycznego sprawdzania,
  - motyw interfejsu,
  - presety lokalizacji.
- Zmiany zapisane po kliknięciu **Zapisz**:
  - `localStorage.setItem('foodwatchSettings', JSON.stringify(settings))`,
  - aktualizacja motywu (data-theme na `<body>`),
  - aktualizacja ustawień powiadomień.

---

## Natywne funkcje urządzenia

- **Kamera**  
  `navigator.mediaDevices.getUserMedia` + `BarcodeDetector` (jeśli dostępny) w `js/scanner.js`.

- **Powiadomienia**  
  `Notification`, `ServiceWorkerRegistration.showNotification` w `js/notifications.js`.

- **Geolokalizacja**  
  `navigator.geolocation.getCurrentPosition` w `js/app.js` (przycisk *Sklepy w pobliżu*).

- **Offline / Cache / Service Worker**  
  `caches`, `install`, `activate`, `fetch` w `sw.js`.

---

## IndexedDB – model danych

Warstwa: `js/db.js`.

### 1. `products` – produkty w spiżarni

```json
{
  "id": 1,
  "barcode": "5901234567890",
  "name": "Mleko 3,2%",
  "brand": "Łaciate",
  "expiry": "2025-11-25",
  "quantity": 2,
  "location": "Lodówka",
  "createdAt": "2025-11-20T18:00:00.000Z"
}
```

### 2. `shopping` – lista zakupów

```json
{
  "id": 5,
  "name": "Mleko 3,2%",
  "brand": "Łaciate",
  "barcode": "5901234567890",
  "status": "todo",
  "source": "expired_auto",
  "createdAt": "2025-11-22T18:00:00.000Z",
  "boughtAt": "2025-11-23T10:12:00.000Z"
}
```

### 3. `history` – log operacji

```json
{
  "id": 10,
  "type": "PRODUCT_ADDED",
  "message": "Dodano produkt do spiżarni",
  "productName": "Mleko 3,2%",
  "productBrand": "Łaciate",
  "createdAt": "2025-11-22T18:04:00.000Z"
}
```

---

## Service Worker i strategia cache

Plik: `sw.js`.

- **Install**
  - otwarcie cache `foodwatch-cache-v1`,
  - dodanie `index.html`, `css/styles.css`, `js/*.js`, ikon.

- **Activate**
  - usunięcie starych cache,
  - `self.clients.claim()`.

- **Fetch**
  - dla adresów zawierających `openfoodfacts`:
    - *network-first* – najpierw sieć, fallback do cache.
  - dla pozostałych:
    - *cache-first* z dogrywką do cache (jeśli brak w cache → `fetch` → zapis do cache).

Dzięki temu:
- aplikacja działa w pełni offline dla zasobów statycznych,
- korzysta z aktualnych danych OpenFoodFacts, ale nie blokuje działania przy braku sieci.

---

## Powiadomienia o ważności

Moduł: `js/notifications.js`.

- `requestNotificationPermission()` – prosi o zgodę użytkownika.
- `checkExpirationsAndNotify()`:
  - pobiera produkty z `PantryDB.getAllProducts()`,
  - liczy:
    - `expired` – data ważności < dziś,
    - `soon` – data ważności ≤ próg „wkrótce” (z ustawień),
  - zapisuje wpis do historii alertów (`localStorage`, max 5),
  - wywołuje `showExpiryNotification(expired, soon)`:
    - to wysyła powiadomienie przez Service Workera (`reg.showNotification`).

---

## Pseudo-„AI” koszyka i statystyki

Moduł: `js/aiPriceAgent.js`.

### `getCategoryForName(name, brand)`

- Analizuje nazwę / markę produktu.
- Na podstawie słów kluczowych przypisuje:
  - kategorię (np. „Nabiał”, „Napoje”, „Warzywa”),
  - emoji kategorii (np. 🥛, 🥤, 🥦).

### `estimateBasketFromShoppingList(shoppingItems)`

- Na podstawie listy kupionych produktów z ostatnich 7 dni:
  - nadaje kategorię każdej pozycji,
  - przypisuje do kategorii przykładową cenę jednostkową,
  - zwraca:
    - `totalEstimate` – orientacyjny koszt koszyka,
    - `count` – liczba rozpoznanych produktów,
    - `byCategory` – lista obiektów `{ category, emoji, estimate, share }`.

Używane w zakładce **Zakupy**:
- główna wartość „Szacunkowy koszt koszyka”,
- chipy z podziałem na kategorie.

---

## Pomysły na rozwój

- Dodanie wieloużytkownikowości (konto + logowanie, synchronizacja w chmurze).
- Integracja z innymi API (np. gotowe przepisy na bazie listy produktów).
- Zaawansowane filtrowanie (np. wg kategorii produktów).
- Eksport do Excela / PDF.
- Tryb „inwentaryzacji” – skanowanie wszystkiego co jest w domu i szybkie przypisywanie lokalizacji.
