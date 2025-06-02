---
tags: ["ln-tool"]
ln-tool-name: "Szablon Narzędzia"
ln-tool-description: "Podstawowy szablon do tworzenia własnych niestandardowych narzędzi"
ln-tool-icon: "wrench"
ln-tool-icon-color: "#6B7280"
ln-tool-enabled: true
---

# Szablon Narzędzia

To jest podstawowy szablon do tworzenia narzędzi definiowanych przez użytkownika. Skopiuj ten plik i zmodyfikuj go, aby utworzyć własne niestandardowe narzędzia!

## Schemat

```json
{
  "name": "template_tool",
  "description": "Podstawowy szablon dla narzędzia definiowanego przez użytkownika",
  "input_schema": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "Tytuł dla utworzonej notatki"
      },
      "content": {
        "type": "string", 
        "description": "Treść do włączenia w notatce"
      },
      "tags": {
        "type": "array",
        "description": "Opcjonalne tagi do dodania do notatki",
        "items": {
          "type": "string"
        }
      }
    },
    "required": ["title"]
  }
}
```

## Implementacja

```javascript
async function execute(context) {
  const { params, plugin, progress, addNavigationTarget, setLabel } = context;
  
  // Funkcja pomocnicza do normalizacji Unicode (wielokrotnego użytku w narzędziach)
  function normalizeUnicode(text) {
    return text
      .normalize('NFKD') // Dekompozycja znaków na podstawowe + diakrytyki
      .replace(/[\u0300-\u036f]/g, ''); // Usunięcie znaków diakrytycznych
  }
  
  try {
    // Ustawienie początkowego statusu
    setLabel("Uruchamianie narzędzia szablonu...");
    progress("Przetwarzanie twojej prośby...");
    
    // Wydobycie parametrów
    const { title, content = "", tags = [] } = params;
    
    // Walidacja wymaganych parametrów
    if (!title || title.trim() === "") {
      throw new Error('Tytuł jest wymagany');
    }
    
    setLabel("Tworzenie notatki...");
    progress(`Tworzenie notatki: ${title}`);
    
    // Budowanie treści notatki
    let noteContent = `# ${title}\n\n`;
    
    // Dodanie znacznika czasu utworzenia
    noteContent += `**Utworzono:** ${new Date().toLocaleString()}\n`;
    
    // Dodanie tagów jeśli podano
    if (tags.length > 0) {
      noteContent += `**Tagi:** ${tags.map(tag => `#${tag}`).join(' ')}\n`;
    }
    
    noteContent += `\n---\n\n`;
    
    // Dodanie głównej treści
    if (content) {
      noteContent += `${content}\n\n`;
    } else {
      noteContent += `*Dodaj swoją treść tutaj...*\n\n`;
    }
    
    // Dodanie stopki
    noteContent += `---\n*Wygenerowane przez Szablon Narzędzia*`;
    
    // Generowanie nazwy pliku z właściwą normalizacją Unicode
    const sanitizedTitle = normalizeUnicode(title).replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${sanitizedTitle} - ${timestamp}.md`;
    
    // Utworzenie pliku
    await plugin.app.vault.create(filename, noteContent);
    
    // Dodanie celu nawigacji do otwarcia utworzonego pliku
    addNavigationTarget({
      filePath: filename,
      description: `Otwórz utworzoną notatkę: ${title}`
    });
    
    // Status sukcesu
    setLabel("Szablon narzędzia ukończony");
    progress(`Pomyślnie utworzono notatkę: ${filename}`);
    
  } catch (error) {
    setLabel("Szablon narzędzia nie powiódł się");
    progress(`Błąd: ${error.message}`);
    throw error;
  }
}
```

## Jak Dostosować Ten Szablon

### 1. Zmień Metadane
- **`ln-tool-name`**: Nazwa wyświetlana twojego narzędzia
- **`ln-tool-description`**: Co robi twoje narzędzie
- **`ln-tool-icon`**: Wybierz z [ikon Lucide](https://lucide.dev/)
- **`ln-tool-icon-color`**: Dowolny kod koloru hex

### 2. Zmodyfikuj Schemat
- **Dodaj parametry**: Zdefiniuj jakie wejścia potrzebuje twoje narzędzie
- **Ustaw typy**: `string`, `number`, `boolean`, `array`, `object`
- **Dodaj walidację**: `required`, `minLength`, `enum`, itp.
- **Napisz opisy**: Pomóż AI zrozumieć każdy parametr

### 3. Zaktualizuj Implementację
- **Zmień logikę**: Zastąp tworzenie notatki swoją funkcjonalnością
- **Dodaj wywołania API**: Użyj `fetch()` dla zewnętrznych usług
- **Operacje na plikach**: Twórz, czytaj, modyfikuj pliki w swoim magazynie
- **Obsługa błędów**: Dodaj bloki try/catch dla stabilnego wykonania

## Powszechne Wzorce Narzędzi

### Narzędzia Tworzące Pliki
```javascript
// Twórz różne typy plików
await plugin.app.vault.create(filename, content);
```

### Narzędzia Przetwarzające Dane
```javascript
// Czytaj i przetwarzaj istniejące pliki
const file = plugin.app.vault.getAbstractFileByPath(path);
const content = await plugin.app.vault.read(file);
```

### Narzędzia Integracji API
```javascript
// Wywołuj zewnętrzne API
const response = await fetch(apiUrl, options);
const data = await response.json();
```

### Narzędzia Wyszukiwania w Magazynie
```javascript
// Przeszukuj swój magazyn
const files = plugin.app.vault.getMarkdownFiles();
const results = files.filter(file => /* twoje kryteria */);
```

## Wskazówki do Rozwoju Narzędzi

1. **Zacznij Prosto**: Rozpocznij od podstawowej funkcjonalności i stopniowo dodawaj funkcje
2. **Testuj Często**: Używaj komendy debug do testowania swoich narzędzi
3. **Obsługuj Błędy**: Zawsze używaj bloków try/catch
4. **Dostarczaj Feedback**: Używaj `progress()` i `setLabel()` aby informować użytkowników
5. **Dodaj Nawigację**: Używaj `addNavigationTarget()` aby pomóc użytkownikom znaleźć wyniki
6. **Waliduj Wejścia**: Sprawdzaj parametry przed przetwarzaniem
7. **Dokumentuj Dobrze**: Włączaj jasne opisy i przykłady

## Następne Kroki

1. **Skopiuj ten plik** aby utworzyć własne narzędzie
2. **Zmień jego nazwę** aby opisać cel twojego narzędzia
3. **Zmodyfikuj schemat** aby zdefiniować swoje parametry
4. **Zaktualizuj implementację** swoją logiką
5. **Przetestuj to** z asystentem AI

Miłego budowania narzędzi! 🔧✨ 