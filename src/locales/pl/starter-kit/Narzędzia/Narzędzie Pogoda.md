---
tags: ["ln-tool"]
ln-tool-name: "Sprawdź Pogodę"
ln-tool-description: "Pobiera aktualne informacje o pogodzie dla określonej lokalizacji"
ln-tool-icon: "cloud"
ln-tool-icon-color: "#87CEEB"
ln-tool-enabled: true
---

# Narzędzie Pogody

To narzędzie pobiera aktualne informacje o pogodzie dla dowolnej lokalizacji używając darmowego API pogody Open-Meteo. Nie wymaga klucza API!

## Schemat

```json
{
  "name": "get_weather",
  "description": "Pobiera aktualne informacje o pogodzie i prognozę dla określonej lokalizacji",
  "input_schema": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "Miasto i kraj/województwo (np. 'Warszawa, Polska' lub 'Kraków, PL')"
      },
      "units": {
        "type": "string",
        "description": "Jednostki temperatury: 'metric' (Celsius), 'imperial' (Fahrenheit)",
        "enum": ["metric", "imperial"],
        "default": "metric"
      },
      "forecast_days": {
        "type": "integer",
        "description": "Liczba dni prognozy do uwzględnienia (1-7)",
        "minimum": 1,
        "maximum": 7,
        "default": 3
      }
    },
    "required": ["location"]
  }
}
```

## Implementacja

```javascript
async function execute(context) {
  const { params, plugin, progress, requestUrl, setLabel } = context;
  
  // Funkcja pomocnicza do normalizacji Unicode (wielokrotnego użytku w narzędziach)
  function normalizeUnicode(text) {
    return text
      .normalize('NFKD') // Dekompozycja znaków na podstawowe + diakrytyki
      .replace(/[\u0300-\u036f]/g, ''); // Usunięcie znaków diakrytycznych
  }
  
  // Opisy warunków pogodowych (kody WMO)
  const weatherDescriptions = {
    0: "Bezchmurnie",
    1: "Przeważnie bezchmurnie", 2: "Częściowo pochmurno", 3: "Pochmurno",
    45: "Mgła", 48: "Szron mglisty",
    51: "Lekka mżawka", 53: "Umiarkowana mżawka", 55: "Gęsta mżawka",
    56: "Lekka marznąca mżawka", 57: "Gęsta marznąca mżawka",
    61: "Słaby deszcz", 63: "Umiarkowany deszcz", 65: "Mocny deszcz",
    66: "Słaby marznący deszcz", 67: "Mocny marznący deszcz",
    71: "Słaby śnieg", 73: "Umiarkowany śnieg", 75: "Mocny śnieg",
    77: "Ziarna śniegu",
    80: "Słabe przelotne opady", 81: "Umiarkowane przelotne opady", 82: "Gwałtowne przelotne opady",
    85: "Słabe opady śniegu", 86: "Mocne opady śniegu",
    95: "Burza", 96: "Burza z lekkim gradem", 99: "Burza z mocnym gradem"
  };
  
  setLabel("Wyszukiwanie lokalizacji...");
  
  const location = params.location;
  const units = params.units || 'metric';
  const forecastDays = params.forecast_days || 3;
  
  progress(`Pobieranie pogody dla: ${location}`);
  
  try {
    // Krok 1: Geokodowanie lokalizacji używając API geokodowania Open-Meteo
    setLabel("Znajdowanie współrzędnych...");
    
    const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=pl&format=json`;
    
    const geocodeResponse = await requestUrl({
      url: geocodeUrl,
      method: 'GET'
    });
    
    if (!geocodeResponse.json || !geocodeResponse.json.results || geocodeResponse.json.results.length === 0) {
      throw new Error(`Nie znaleziono lokalizacji "${location}". Spróbuj innej lokalizacji lub bądź bardziej precyzyjny (np. "Londyn, Wielka Brytania")`);
    }
    
    const locationData = geocodeResponse.json.results[0];
    const { latitude, longitude, name, country, admin1 } = locationData;
    
    const displayLocation = admin1 ? `${name}, ${admin1}, ${country}` : `${name}, ${country}`;
    
    // Krok 2: Pobieranie danych pogodowych z Open-Meteo
    setLabel("Pobieranie danych pogodowych...");
    
    const tempUnit = units === 'imperial' ? 'fahrenheit' : 'celsius';
    const windUnit = units === 'imperial' ? 'mph' : 'kmh';
    const precipUnit = units === 'imperial' ? 'inch' : 'mm';
    
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&precipitation_unit=${precipUnit}&timezone=auto&forecast_days=${forecastDays}`;
    
    const weatherResponse = await requestUrl({
      url: weatherUrl,
      method: 'GET'
    });
    
    if (!weatherResponse.json) {
      throw new Error('Nie udało się pobrać danych pogodowych z API Open-Meteo');
    }
    
    const weatherData = weatherResponse.json;
    const current = weatherData.current;
    const daily = weatherData.daily;
    
    setLabel("Przetwarzanie informacji o pogodzie...");
    
    // Formatowanie aktualnej pogody
    const tempSymbol = units === 'imperial' ? '°F' : '°C';
    const windSymbol = units === 'imperial' ? ' mph' : ' km/h';
    const precipSymbol = units === 'imperial' ? ' in' : ' mm';
    
    const currentTemp = Math.round(current.temperature_2m);
    const feelsLike = Math.round(current.apparent_temperature);
    const humidity = current.relative_humidity_2m;
    const windSpeed = Math.round(current.wind_speed_10m);
    const windDir = current.wind_direction_10m;
    const pressure = Math.round(current.pressure_msl);
    const cloudCover = current.cloud_cover;
    const precipitation = current.precipitation;
    
    const currentWeatherDesc = weatherDescriptions[current.weather_code] || 'Nieznane';
    
    // Konwersja kierunku wiatru
    const getWindDirection = (degrees) => {
      const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
      return directions[Math.round(degrees / 22.5) % 16];
    };
    
    setLabel("Informacje o pogodzie pobrane");
    
    // Wyświetlanie aktualnej pogody
    progress(`**Aktualna Pogoda dla ${displayLocation}**`);
    progress(`*Aktualizacja: ${new Date(current.time).toLocaleString('pl-PL')}*`);
    progress('');
    progress('**Aktualne Warunki:**');
    progress(`🌡️ Temperatura: ${currentTemp}${tempSymbol} (odczuwalna ${feelsLike}${tempSymbol})`);
    progress(`☁️ Warunki: ${currentWeatherDesc}`);
    progress(`💧 Wilgotność: ${humidity}%`);
    progress(`💨 Wiatr: ${windSpeed}${windSymbol} ${getWindDirection(windDir)} (${windDir}°)`);
    progress(`🗜️ Ciśnienie: ${pressure} hPa`);
    progress(`☁️ Zachmurzenie: ${cloudCover}%`);
    
    if (precipitation > 0) {
      progress(`🌧️ Opady: ${precipitation}${precipSymbol}`);
    }
    
    // Wyświetlanie prognozy
    if (forecastDays > 1) {
      progress('');
      progress(`**Prognoza ${forecastDays}-Dniowa:**`);
      
      for (let i = 0; i < Math.min(forecastDays, daily.time.length); i++) {
        const date = new Date(daily.time[i]);
        const dayName = i === 0 ? 'Dzisiaj' : 
                      i === 1 ? 'Jutro' : 
                      date.toLocaleDateString('pl-PL', { weekday: 'long' });
        
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);
        const dailyWeatherDesc = weatherDescriptions[daily.weather_code[i]] || 'Nieznane';
        const precipProb = daily.precipitation_probability_max[i];
        const precipSum = daily.precipitation_sum[i];
        const maxWind = Math.round(daily.wind_speed_10m_max[i]);
        const windDirection = getWindDirection(daily.wind_direction_10m_dominant[i]);
        
        progress(`**${dayName}**: ${dailyWeatherDesc}`);
        progress(`  🌡️ ${minTemp}${tempSymbol} / ${maxTemp}${tempSymbol}`);
        
        if (precipProb > 0) {
          progress(`  🌧️ ${precipProb}% prawdopodobieństwo opadów${precipSum > 0 ? ` (${precipSum}${precipSymbol})` : ''}`);
        }
        
        progress(`  💨 Wiatr: ${maxWind}${windSymbol} ${windDirection}`);
        progress('');
      }
    }
    
    progress('*Dane pogodowe dostarczone przez Open-Meteo.com*');
    progress('*Darmowe API pogody bez wymaganej rejestracji*');
    
    setLabel("Raport pogodowy ukończony");
    
  } catch (error) {
    setLabel("Pobieranie pogody nie powiodło się");
    progress(`Błąd: ${error.message}`);
    
    if (error.message.includes('znaleziono')) {
      progress('');
      progress('**Porady rozwiązywania problemów:**');
      progress('• Spróbuj podać kraj (np. "Paryż, Francja")');
      progress('• Używaj angielskich nazw lokalizacji');
      progress('• Sprawdź pisownię lokalizacji');
      progress('• Dla miast w USA podaj stan (np. "Portland, Oregon")');
    }
    
    throw error;
  }
}
```

## Przykłady Użycia

1. **Podstawowe zapytanie o pogodę**: "Jaka jest pogoda w Tokio?"
2. **Z jednostkami**: "Pobierz pogodę dla Berlina w Fahrenheitach"
3. **Rozszerzona prognoza**: "Pokaż mi 7-dniową prognozę dla Sydney, Australia"
4. **Konkretna lokalizacja**: "Pogoda dla San Francisco, Kalifornia"

## Funkcje

- **Prawdziwe dane pogodowe** z API Open-Meteo (bez wymaganego klucza API)
- **Aktualne warunki** z temperaturą, wilgotnością, wiatrem, ciśnieniem
- **Prognozy wielodniowe** (1-7 dni)
- **Automatyczne wyszukiwanie lokalizacji** z geokodowaniem
- **Obsługa konwersji jednostek** (Celsius/Fahrenheit, km/h/mph)
- **Szczegółowe opisy pogody** używając kodów pogodowych WMO
- **Konwersja i wyświetlanie kierunku wiatru**
- **Informacje o opadach** wraz z prawdopodobieństwem i ilościami

## Źródło Danych

To narzędzie używa darmowego API pogody Open-Meteo, które zapewnia:
- Prognozy pogodowe wysokiej rozdzielczości
- Pokrycie globalne
- Brak wymaganego klucza API
- Dane z krajowych służb meteorologicznych
- Godzinne aktualizacje dla większości regionów

Dowiedz się więcej na: https://open-meteo.com 