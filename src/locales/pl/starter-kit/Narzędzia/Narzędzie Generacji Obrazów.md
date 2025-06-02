---
tags: ["ln-tool"]
ln-tool-description: "Generuje obrazy używając modelu GPT-4o OpenAI i zapisuje je w sejfie"
ln-tool-version: "1.0.0"
ln-tool-icon: "image"
ln-tool-enabled: true
---

# Narzędzie Generacji Obrazów

To narzędzie generuje obrazy używając modelu GPT-4o OpenAI poprzez bezpośrednie zapytania API i zapisuje je w twoim sejfie.

## Schema

```json
{
  "name": "generate_image",
  "description": "Generuje obraz używając modelu generacji obrazów GPT-4o OpenAI i zapisuje go w określonej ścieżce w sejfie. Używa najnowszego modelu gpt-image-1 dla lepszego podążania za instrukcjami i fotorealistycznych rezultatów.",
  "input_schema": {
    "type": "object",
    "properties": {
      "prompt": {
        "type": "string",
        "description": "Szczegółowy opis obrazu do wygenerowania. Bądź konkretny i opisowy dla najlepszych rezultatów."
      },
      "path": {
        "type": "string",
        "description": "Ścieżka gdzie obraz powinien zostać zapisany (włączając nazwę pliku z rozszerzeniem .jpg lub .png). Katalogi zostaną utworzone jeśli nie istnieją."
      },
      "size": {
        "type": "string",
        "description": "Rozmiar obrazu. Opcje: '1024x1024' (kwadrat), '1536x1024' (portret), '1024x1536' (krajobraz), 'auto' (model decyduje). Domyślnie: '1024x1024'",
        "enum": ["1024x1024", "1536x1024", "1024x1536", "auto"]
      },
      "quality": {
        "type": "string",
        "description": "Jakość obrazu. Opcje: 'low', 'medium', 'high', 'auto' (model decyduje). Domyślnie: 'auto'",
        "enum": ["low", "medium", "high", "auto"]
      }
    },
    "required": ["prompt", "path"]
  }
}
```

## Implementacja

```javascript
async function execute(context) {
  const { params, plugin, progress, addNavigationTarget, setLabel, getSecret } = context;
  
  // Funkcja pomocnicza do normalizacji Unicode (wielokrotnego użytku w narzędziach)
  function normalizeUnicode(text) {
    return text
      .normalize('NFKD') // Dekompozycja znaków na podstawowe + diakrytyki
      .replace(/[\u0300-\u036f]/g, ''); // Usunięcie znaków diakrytycznych
  }
  
  const { prompt, path, size = "1024x1024", quality = "auto" } = params;

  setLabel(`Generuję obraz: ${path}`);

  // Walidacja danych wejściowych
  if (!prompt || prompt.trim().length === 0) {
    setLabel(`Nie udało się wygenerować obrazu: ${path}`);
    throw new Error('Prompt nie może być pusty');
  }

  if (!path || path.trim().length === 0) {
    setLabel(`Nie udało się wygenerować obrazu: ${path}`);
    throw new Error('Ścieżka nie może być pusta');
  }

  // Upewnij się, że ścieżka ma rozszerzenie obrazu
  let normalizedPath = path;
  if (!normalizedPath.match(/\.(jpg|jpeg|png)$/i)) {
    normalizedPath += '.jpg'; // Domyślnie jpg dla obrazów GPT-4o
  }

  // Sprawdź czy plik już istnieje
  const fileExists = await plugin.app.vault.adapter.exists(normalizedPath);
  if (fileExists) {
    setLabel(`Nie udało się wygenerować obrazu: ${normalizedPath}`);
    throw new Error(`Plik już istnieje: ${normalizedPath}`);
  }

  // Pobierz klucz API OpenAI z sekretów
  const openaiApiKey = getSecret('OPENAI_API_KEY');
  if (!openaiApiKey || openaiApiKey.trim().length === 0) {
    setLabel(`Nie udało się wygenerować: ${path}`);
    throw new Error('Klucz API OpenAI nie jest skonfigurowany. Proszę dodaj "OPENAI_API_KEY" do swoich sekretów w ustawieniach wtyczki.');
  }

  try {
    progress(`Generuję obraz z promptem: ${prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '')}`);

    // Wykonaj bezpośrednie zapytanie API do OpenAI Images API
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: prompt,
        size: size,
        quality: quality,
        n: 1,
        response_format: "b64_json"
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 429) {
        throw new Error('Przekroczono limit API. Sprawdź swoje konto OpenAI.');
      } else if (response.status === 401) {
        throw new Error('Nieprawidłowy klucz API. Sprawdź konfigurację OpenAI.');
      } else if (errorData.error?.message) {
        throw new Error(`Błąd API OpenAI: ${errorData.error.message}`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      throw new Error('Nie otrzymano danych obrazu z API');
    }

    const imageData = data.data[0];
    if (!imageData.b64_json) {
      throw new Error('Brak danych obrazu base64 w odpowiedzi API');
    }

    progress('Przetwarzam dane obrazu...');

    // Konwertuj base64 do bufora binarnego
    const imageBuffer = new Uint8Array(
      atob(imageData.b64_json)
        .split('')
        .map(char => char.charCodeAt(0))
    );

    progress('Zapisuję obraz do sejfu...');

    // Upewnij się, że katalog istnieje
    const directoryPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
    if (directoryPath) {
      const dirExists = await plugin.app.vault.adapter.exists(directoryPath);
      if (!dirExists) {
        await plugin.app.vault.adapter.mkdir(directoryPath);
      }
    }

    // Utwórz plik binarny używając API sejfu Obsidian
    await plugin.app.vault.createBinary(normalizedPath, imageBuffer);

    // Dodaj cel nawigacji
    addNavigationTarget({
      filePath: normalizedPath,
      description: 'Otwórz wygenerowany obraz'
    });

    setLabel(`Obraz zapisany: ${normalizedPath}`);
    progress(`Pomyślnie wygenerowano i zapisano obraz: ${normalizedPath}`);

  } catch (error) {
    console.error('Błąd generowania obrazu:', error);
    setLabel(`Nie udało się wygenerować obrazu: ${normalizedPath}`);
    throw new Error(`Generacja obrazu nie powiodła się: ${error.message}`);
  }
}
```

## Użycie

AI może używać tego narzędzia do generowania obrazów na podstawie twoich próśb. Narzędzie obsługuje:

- **Wysokiej jakości generację obrazów** używając najnowszego modelu GPT-4o OpenAI
- **Elastyczne opcje rozmiaru** (kwadrat, portret, krajobraz, lub auto)
- **Kontrolę jakości** (niska, średnia, wysoka, lub auto)
- **Bezpośrednią integrację z sejfem** - obrazy są zapisywane bezpośrednio w twoim sejfie Obsidian
- **Tworzenie katalogów** - automatycznie tworzy katalogi jeśli nie istnieją

## Przykłady

**Podstawowa generacja obrazu:**
- "Wygeneruj obraz zachodu słońca nad górami i zapisz jako 'zachod.jpg'"

**Ze specyficznymi parametrami:**
- "Stwórz obraz w formacie portretowym robotycznego kota w stylu cyberpunk, wysoka jakość, zapisz jako 'obrazy/robot-kot.png'"

**Kreatywne prompty:**
- "Wygeneruj fotorealistyczny obraz pływającej wyspy z wodospadami, magiczne oświetlenie, zapisz jako 'fantazja/plywajaca-wyspa.jpg'"

## Wymagania

- Klucz API OpenAI skonfigurowany w sekretach wtyczki jako 'OPENAI_API_KEY'
- Wystarczające kredyty OpenAI do generacji obrazów
- Uprawnienia do zapisu w katalogu sejfu gdzie obrazy będą zapisywane 