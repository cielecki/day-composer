---
tags: ["ln-tool"]
ln-tool-description: "Przeprowadza kompleksowe badania internetowe używając API Firecrawl i zapisuje szczegółowe raporty z cytatami"
ln-tool-version: "1.0.0"
ln-tool-icon: "search"
ln-tool-enabled: true
---

# Narzędzie Głębokich Badań

To narzędzie przeprowadza kompleksowe badania internetowe na dowolny temat używając możliwości głębokich badań Firecrawl poprzez bezpośrednie zapytania API. Przeszukuje wiele źródeł, ekstraktuje istotne informacje i syntetyzuje ustalenia w szczegółowy raport z cytatami.

## Schema

```json
{
  "name": "deep_research",
  "description": "Przeprowadza kompleksowe badania internetowe na dany temat używając możliwości głębokich badań Firecrawl. Przeszukuje wiele źródeł, ekstraktuje istotne informacje i syntetyzuje ustalenia w szczegółowy raport z cytatami. Zapisuje raport badawczy do określonego pliku.",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Zapytanie badawcze lub temat do dogłębnego zbadania"
      },
      "path": {
        "type": "string",
        "description": "Ścieżka gdzie raport badawczy powinien zostać zapisany (włączając nazwę pliku z rozszerzeniem .md)"
      },
      "max_depth": {
        "type": "number",
        "description": "Maksymalna głębokość iteracji badawczych (1-10, domyślnie: 3)",
        "minimum": 1,
        "maximum": 10
      },
      "max_urls": {
        "type": "number", 
        "description": "Maksymalna liczba URL-i do analizy (5-50, domyślnie: 20)",
        "minimum": 5,
        "maximum": 50
      },
      "timeout": {
        "type": "number",
        "description": "Timeout w sekundach dla procesu badawczego (60-300, domyślnie: 180)",
        "minimum": 60,
        "maximum": 300
      },
      "overwrite": {
        "type": "boolean",
        "description": "Czy nadpisać plik jeśli już istnieje. Domyślnie false",
        "default": false
      }
    },
    "required": ["query", "path"]
  }
}
```

## Implementacja

```javascript
async function execute(context) {
  const { params, plugin, progress, addNavigationTarget, setLabel } = context;
  
  const { query, path, max_depth = 3, max_urls = 20, timeout = 180, overwrite = false } = params;

  setLabel(`Badam: ${query}`);

  // Walidacja danych wejściowych
  if (!query || query.trim().length === 0) {
    setLabel(`Nie udało się zbadać: ${query}`);
    throw new Error('Zapytanie badawcze nie może być puste');
  }

  if (!path || path.trim().length === 0) {
    setLabel(`Nie udało się zbadać: ${path}`);
    throw new Error('Ścieżka nie może być pusta');
  }

  // Pobierz klucz API Firecrawl z sekretów
  const firecrawlApiKey = getSecret('FIRECRAWL_API_KEY');
  if (!firecrawlApiKey || firecrawlApiKey.trim().length === 0) {
    setLabel(`Nie udało się zbadać: ${query}`);
    throw new Error('Klucz API Firecrawl nie jest skonfigurowany. Proszę dodaj "FIRECRAWL_API_KEY" do swoich sekretów w ustawieniach wtyczki.');
  }

  // Konfiguruj parametry badań
  const researchParams = {
    maxDepth: Math.min(Math.max(max_depth, 1), 10),
    timeLimit: Math.min(Math.max(timeout, 60), 300),
    maxUrls: Math.min(Math.max(max_urls, 5), 50)
  };

  try {
    progress(`Rozpoczynam głębokie badania dla: ${query}`);

    // Wykonaj bezpośrednie zapytanie API do Firecrawl Deep Research API
    const response = await fetch('https://api.firecrawl.dev/v1/research', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        maxDepth: researchParams.maxDepth,
        timeLimit: researchParams.timeLimit,
        maxUrls: researchParams.maxUrls
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 429) {
        throw new Error('Przekroczono limit API. Sprawdź swoje konto Firecrawl.');
      } else if (response.status === 401) {
        throw new Error('Nieprawidłowy klucz API. Sprawdź konfigurację Firecrawl.');
      } else if (errorData.error?.message) {
        throw new Error(`Błąd API Firecrawl: ${errorData.error.message}`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      const errorMsg = data.error || 'Wystąpił nieznany błąd podczas badań';
      
      if (errorMsg.includes('quota') || errorMsg.includes('limit')) {
        throw new Error('Przekroczono limit API. Sprawdź swoje konto Firecrawl.');
      } else if (errorMsg.includes('timeout')) {
        throw new Error('Badania przekroczyły limit czasu. Spróbuj zmniejszyć zakres lub zwiększyć timeout.');
      } else {
        throw new Error(`Badania nie powiodły się: ${errorMsg}`);
      }
    }

    const researchData = data.data;
    if (!researchData) {
      throw new Error('Nie otrzymano wyników badań z API');
    }

    progress('Przetwarzam wyniki badań...');

    // Formatuj wyniki badań
    let formattedResult = `# Wyniki Głębokich Badań: ${query}\n\n`;
    
    // Dodaj podsumowanie/analizę badań jeśli dostępne
    if (researchData.finalAnalysis) {
      formattedResult += `## Streszczenie Wykonawcze\n\n${researchData.finalAnalysis}\n\n`;
    }

    // Dodaj źródła jeśli dostępne
    if (researchData.sources && researchData.sources.length > 0) {
      formattedResult += `## Źródła (${researchData.sources.length})\n\n`;
      researchData.sources.forEach((source, index) => {
        const title = source.title || source.url || `Źródło ${index + 1}`;
        const url = source.url || '';
        const description = source.description || '';
        
        formattedResult += `${index + 1}. **${title}**\n`;
        if (url) {
          formattedResult += `   - URL: ${url}\n`;
        }
        if (description) {
          formattedResult += `   - ${description}\n`;
        }
        formattedResult += '\n';
      });
    }

    // Dodaj aktywności badawcze jeśli dostępne
    if (researchData.activities && researchData.activities.length > 0) {
      formattedResult += `## Proces Badawczy\n\n`;
      researchData.activities.forEach((activity, index) => {
        if (activity.message) {
          const timestamp = activity.timestamp ? new Date(activity.timestamp).toLocaleTimeString() : '';
          const typeIcon = activity.type === 'search' ? '🔍' : 
                          activity.type === 'analyze' ? '🧠' : 
                          activity.type === 'synthesis' ? '✨' : '🔄';
          
          formattedResult += `${index + 1}. ${typeIcon} ${activity.message}`;
          if (timestamp) {
            formattedResult += ` (${timestamp})`;
          }
          formattedResult += '\n';
        }
      });
      formattedResult += '\n';
    }

    // Dodaj metadane badań
    formattedResult += `## Metadane Badań\n\n`;
    formattedResult += `- **Zapytanie**: ${query}\n`;
    formattedResult += `- **Maks. Głębokość**: ${researchParams.maxDepth}\n`;
    formattedResult += `- **Maks. URL-e**: ${researchParams.maxUrls}\n`;
    formattedResult += `- **Timeout**: ${researchParams.timeLimit}s\n`;
    if (researchData.sources) {
      formattedResult += `- **Znalezione Źródła**: ${researchData.sources.length}\n`;
    }
    formattedResult += `- **Ukończono**: ${new Date().toISOString()}\n\n`;

    progress('Zapisuję raport badawczy...');

    // Generuj unikalną nazwę pliku jeśli plik istnieje i overwrite to false
    let finalPath = path;
    if (await plugin.app.vault.adapter.exists(path) && !overwrite) {
      const baseName = path.replace(/\.md$/, '');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      finalPath = `${baseName} ${timestamp}.md`;
    }

    // Upewnij się że katalog istnieje
    const directoryPath = finalPath.substring(0, finalPath.lastIndexOf('/'));
    if (directoryPath) {
      const dirExists = await plugin.app.vault.adapter.exists(directoryPath);
      if (!dirExists) {
        await plugin.app.vault.adapter.mkdir(directoryPath);
      }
    }

    // Zapisz raport badawczy do określonego pliku
    await plugin.app.vault.create(finalPath, formattedResult);
    
    // Utwórz cel nawigacji dla raportu badawczego
    addNavigationTarget({
      filePath: finalPath,
      description: 'Otwórz raport badawczy'
    });

    const sourceCount = researchData.sources ? researchData.sources.length : 0;
    setLabel(`Badania ukończone: ${finalPath}`);
    progress(`Pomyślnie ukończono badania na temat "${query}" z ${sourceCount} źródłami. Raport zapisany do: ${finalPath}`);

  } catch (error) {
    console.error('Błąd w narzędziu głębokich badań:', error);
    setLabel(`Nie udało się zbadać: ${query}`);
    throw new Error(`Głębokie badania nie powiodły się: ${error.message}`);
  }
}
```

## Użycie

AI może używać tego narzędzia do przeprowadzania kompleksowych badań internetowych na dowolny temat. Narzędzie obsługuje:

- **Badania wieloźródłowe** używając możliwości głębokich badań Firecrawl
- **Konfigurowalna głębokość i zakres** do kontrolowania dokładności badań
- **Aktualizacje postępu w czasie rzeczywistym** podczas procesu badawczego
- **Kompleksowe raporty** ze streszczenimi wykonawczymi, źródłami i metadanymi
- **Bezpośrednia integracja z sejfem** - raporty badawcze są zapisywane bezpośrednio w twoim sejfie Obsidian
- **Automatyczne tworzenie katalogów** - tworzy katalogi jeśli nie istnieją

## Przykłady

**Podstawowe badania:**
- "Zbadaj najnowsze osiągnięcia w energii odnawialnej i zapisz raport jako 'energia-odnawialna-2025.md'"

**Ze specyficznymi parametrami:**
- "Przeprowadź głębokie badania etyki sztucznej inteligencji, maks. głębokość 5, 30 URL-i, zapisz jako 'badania/etyka-ai-kompleksowe.md'"

**Badania techniczne:**
- "Zbadaj przełomy w komputerach kwantowych w 2024, timeout 300 sekund, zapisz jako 'raport-komputery-kwantowe.md'"

## Wymagania

- Klucz API Firecrawl skonfigurowany w sekretach wtyczki jako 'FIRECRAWL_API_KEY'
- Wystarczające kredyty Firecrawl do operacji badawczych
- Uprawnienia do zapisu w katalogu sejfu gdzie raporty będą zapisywane

## Konfiguracja

1. Uzyskaj klucz API Firecrawl z [firecrawl.dev](https://firecrawl.dev)
2. Dodaj go do sekretów wtyczki z nazwą klucza 'FIRECRAWL_API_KEY'
3. Narzędzie automatycznie użyje tego klucza do zapytań badawczych 