# TODO

## Release to familiy and friends
- [x] rename day-note to ln-day-note ...
- [x] Take few days off to release this
- [x] ln-current-date-and-time link that generates information about current time
- [x] Starter kit translations
- [x] Add task backlog to stater kit
- [x] Removed ln_voice_speed from starter kit as mini tts does not support it

- [ ] Napisałem na ten temat, co mam, do Bartka, Natalii i Trenera
- [ ] coś nie tak jest z tym jak przykłady są robione
- [ ] Is the domain free?

- [ ] More relaxed todo format in the plugin

## AI breakfast release
- [ ] 🔧 Dodać funkcję edycji todo itemów
- [ ] Fajniejszy tutorial dotyczący klucza antropica i openai
- [ ] Working daily planning and habits
- [ ] Choose licence

- [ ] Add plugin to obsidian repository
- [ ] Create discord server
- [ ] Create a presentation for AI breakfast
- [ ] Write a draft blog post for people to read through and give feedback on
- [ ] Write down the obsidian bullet journal md format that the plugin uses
- [ ] Create tool documentation in README or MODE_GUIDE or smth

## Initial release
- [ ] Bug: checking off 0 zadan as it's beeing generatred
- [ ] Lepszy entry level experience
- [ ] 🔧 Poprawić funkcjonalność przenoszenia zadań (problem z dodawaniem do konkretnych dni)
- [ ] 📝 Asystentka - Zachowywać dokładnie oryginalne sformułowania użytkownika bez robienia rephrasingów
- [ ] Pouzupełnianie brakujących translacji
- [ ] ln-currently-opened-document 
- [ ] Upewnienie się że AI rozumiem ze [-] to anulowany task
- [ ] Disable show todo for now
- [ ] Naprawić w life navigatorze:
```markdown
❌ Nie znaleziono zadania ""🍳 10:30 Śniadanie z Michałem"" w {{path}}. Jeśli zadanie znajduje się w innym pliku, określ go w parametrze file_path.
```

- [ ] I made a marketing plan of the Vibe Living project

## Nice to haves
- [ ] Life navigator: comments jak sa multiline to zle sie formatuja po dodaniu do notatki przez AI
- [ ] 🐛 Naprawić problem automatycznego dodawania niepotrzebnych komentarzy
- [ ] 🔄 Wprowadź zapamiętywanie aktualnego trybu pomiędzy uruchomieniami w Obsidianie
- [ ] abandoning powinien przenosić zadania na początek notatki dla lepszej widoczności
- [ ] Bug gdy zastopuje generowanego tool calla
- [ ] Dodać możliwość konfiguracjii tooli w trybach
- [ ] Distinct animation for when speach is being generated vs when it's playing

```markdown
conversation turn processing: BadRequestError: 400 {"type":"error","error":{"type":"invalid_request_error","message":"messages.4: `tool_use` ids were found without `tool_result` blocks immediately after: toolu_016aY9VAzzsaK6mWENg3JN8L. Each `tool_use` block must have a corresponding `tool_result` block in the next message."}}
    at _APIError.generate (plugin:day-composer:48107:14)
    at Anthropic.makeStatusError (plugin:day-composer:48883:21)
    at Anthropic.makeRequest (plugin:day-composer:48928:24)
    at async eval (plugin:day-composer:51631:28)
    at async eval (plugin:day-composer:51802:49)
```

- [ ] handover tool do innych trybów 

## After initial testing release
- [ ] Yearly and monthly notes from the other plugin
- [ ] Chat history (as markdown files?)
- [ ] point of insertion should be after the last completed task, not before the first uncompleted one
- [ ] How to load extra tools? Some eval? Some Jsony? Mcp?
- [ ] Add support for Gemini model from Google, and add a model selection option
- [ ] Readd a function to show the list of tasks as a toolcall - a tool that the user can open

## Someday / Maybe
- [ ] 🔄 Rethink the concept of creating a new chat for each voice message without automatically switching to it
- [ ] Weather fetching tool
- [ ] Why are mobile styles completely different and there's a contrast issue?
- [ ] Could we create an agent that activates at random moments?
- [ ] Passive listening agent
- [ ] Advanced tools for comparing and applying differences (diff apply)
- [ ] Google Calendar integration - Create a system to extract calendar information about upcoming events so the system can include this data in my daily tasks (today plus next 7 days)
- [ ] Habits editing
