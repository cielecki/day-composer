---
tags: ["ln-tool"]
ln-tool-name: "Pobierz Transkrypcję YouTube"
ln-tool-description: "Pobiera transkrypcję z filmów YouTube bez używania pakietów npm"
ln-tool-version: "1.0.0"
ln-tool-icon: "youtube"
ln-tool-icon-color: "#ff0000"
ln-tool-enabled: true
---

# Narzędzie Pobierania Transkrypcji YouTube

To narzędzie pobiera transkrypcje z filmów YouTube używając API requestUrl Obsidiana, które omija ograniczenia CORS.

## Schemat

```json
{
  "name": "youtube_transcript_download",
  "description": "Pobiera transkrypcję z URL filmu YouTube",
  "input_schema": {
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "description": "URL filmu YouTube"
      },
      "filename": {
        "type": "string", 
        "description": "Opcjonalna nazwa pliku dla transkrypcji (bez rozszerzenia)"
      }
    },
    "required": ["url"]
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
  
  setLabel("Wydobywanie ID filmu...");
  
  // Wydobycie ID filmu z URL
  const videoId = extractVideoId(params.url);
  if (!videoId) {
    throw new Error('Podano nieprawidłowy URL YouTube');
  }
  
  progress(`Wydobywanie transkrypcji dla filmu: ${videoId}`);
  setLabel("Pobieranie transkrypcji...");
  
  try {
    // Pobranie strony filmu w celu uzyskania danych transkrypcji
    const response = await requestUrl({
      url: `https://www.youtube.com/watch?v=${videoId}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Niepowodzenie pobierania strony YouTube: HTTP ${response.status}`);
    }

    const html = response.text;
    
    // Wydobycie tytułu
    const titleMatch = html.match(/<title>([^<]*)/);
    const title = titleMatch ? titleMatch[1].replace(' - YouTube', '') : 'Film YouTube';
    
    // Wydobycie ytInitialPlayerResponse ze strony
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (!playerResponseMatch) {
      throw new Error("Nie można znaleźć danych odpowiedzi odtwarzacza na stronie YouTube");
    }

    const playerResponse = JSON.parse(playerResponseMatch[1]);
    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    
    if (captionTracks.length === 0) {
      throw new Error("Brak dostępnych napisów dla tego filmu");
    }

    // Znajdź najlepszą ścieżkę napisów (preferuj angielski, potem dowolny dostępny)
    let selectedTrack = captionTracks.find(track => track.languageCode === 'en');
    if (!selectedTrack) {
      selectedTrack = captionTracks[0];
    }

    if (!selectedTrack?.baseUrl) {
      throw new Error("Nie znaleziono prawidłowej ścieżki napisów");
    }

    setLabel("Przetwarzanie transkrypcji...");

    // Pobierz dane napisów
    const captionUrl = selectedTrack.baseUrl + '&fmt=json3';
    const captionResponse = await requestUrl({
      url: captionUrl,
      method: 'GET'
    });

    if (captionResponse.status < 200 || captionResponse.status >= 300) {
      throw new Error(`Niepowodzenie pobierania napisów: HTTP ${captionResponse.status}`);
    }

    const captionData = JSON.parse(captionResponse.text);
    const events = captionData.events || [];

    // Przetwórz zdarzenia na segmenty transkrypcji
    const segments = [];
    
    for (const event of events) {
      if (event.segs) {
        const text = event.segs
          .map(seg => seg.utf8 || '')
          .join('')
          .replace(/[\u200B-\u200D\uFEFF]/g, '') // Usuń znaki o zerowej szerokości
          .trim();
        
        if (text) {
          segments.push({
            text: text,
            offset: event.tStartMs ? parseFloat(event.tStartMs) / 1000 : 0,
            duration: event.dDurationMs ? parseFloat(event.dDurationMs) / 1000 : 0
          });
        }
      }
    }

    if (segments.length === 0) {
      throw new Error("Nie znaleziono treści transkrypcji w napisach");
    }

    // Formatuj transkrypcję
    const transcript = `# Transkrypcja YouTube

**Film:** ${params.url}
**Tytuł:** ${title}
**ID Filmu:** ${videoId}
**Pobrano:** ${new Date().toISOString()}

## Transkrypcja

${segments.map(item => {
  const startTime = item.offset;
  const minutes = Math.floor(startTime / 60);
  const seconds = Math.floor(startTime % 60);
  const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  return `**[${timestamp}]** ${item.text}`;
}).join('\n\n')}`;
    
    // Utworzenie nazwy pliku z właściwą normalizacją Unicode
    const baseFilename = params.filename || normalizeUnicode(title).replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const filename = `${baseFilename} - Transkrypcja.md`;
    
    // Zapisanie transkrypcji do magazynu
    await plugin.app.vault.create(filename, transcript);
    
    // Dodanie celu nawigacji
    addNavigationTarget({
      filePath: filename,
      description: `Otwórz transkrypcję: ${title}`
    });
    
    setLabel("Transkrypcja pobrana");
    progress(`Pomyślnie zapisano transkrypcję do: ${filename}`);
    
  } catch (error) {
    setLabel("Pobieranie nie powiodło się");
    throw error;
  }
}

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}
```

## Jak Używać

1. **Zdobądź URL YouTube** - Skopiuj dowolny URL filmu YouTube
2. **Zapytaj AI** - "Pobierz transkrypcję z tego filmu YouTube: [URL]"
3. **Opcjonalna nazwa pliku** - "Zapisz transkrypcję jako 'Mój Film'"
4. **Sprawdź wynik** - Narzędzie utworzy nową notatkę z transkrypcją

## Uwagi

To narzędzie używa teraz API `requestUrl` Obsidiana, które omija ograniczenia CORS, które blokowałyby zwykłe wywołania `fetch()`. Wydobywa rzeczywiste dane transkrypcji z wewnętrznych API YouTube i formatuje je jako czytelny dokument Markdown z znacznikami czasu.

Narzędzie obsługuje:
- Wiele formatów URL YouTube
- Automatyczne wydobywanie tytułu
- Formatowanie znaczników czasu
- Obsługę błędów dla filmów bez transkrypcji
- Generowanie unikalnych nazw plików

Możesz zmodyfikować to narzędzie lub użyć go jako szablonu dla własnych narzędzi przetwarzania wideo! 