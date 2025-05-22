# TODO

## Release to familiy and friends
- [x] rename day-note to ln-day-note ...
- [x] Take few days off to release this
- [x] ln-current-date-and-time link that generates information about current time
- [x] Starter kit translations
- [x] Add task backlog to starter kit
- [x] Removed ln_voice_speed from starter kit as mini tts does not support it
- [x] fixed example usages so more of them are visible
- [x] Is the domain free? no
- [x] Test with N
- [x] Update checker should refresh obsidian
- [x] Fix transcription issues
- [x] WTF? <tag_indeks file="Info/_Indeks_.md">
- [x] Standardized naming from "Starter Pack" to "Starter Kit" throughout the codebase
- [x] ln-currently-open-file w speech to text
- [x] ln-current-chat in speech to text?
- [x] Name of the modes should come from file name not ln_name
- [x] Bug: checking off 0 zadan as it's beeing generatrd
- [x] Upgrade from Claude 3.7 Sonnet to Claude 4


- [ ] 🔄 Wprowadź zapamiętywanie aktualnego trybu pomiędzy uruchomieniami w Obsidianie

- [ ] Styling for non dark mode users is off
- [ ] Why are mobile styles completely different and there's a contrast issue?

- [ ] AI Coach -> Life Navigator

- [ ] Working daily planning and habits in the starter kit

- [ ] Distinct animation for when speach is being generated vs when it's playing

- [ ] Test with B
- [ ] Test with Piotr
- [ ] Acquire as many test users as possible

- [ ] Modes are not translated to english

## AI breakfast release
- [ ] 🔧 Dodać funkcję edycji todo itemów
- [ ] 🔧 Poprawić funkcjonalność przenoszenia zadań (problem z dodawaniem do konkretnych dni)
- [ ] Life navigator: comments jak sa multiline to zle sie formatuja po dodaniu do notatki przez AI
- [ ] abandoning powinien przenosić zadania na początek notatki dla lepszej widoczności

- [ ] Write down the obsidian bullet journal md format that the plugin uses
- [ ] Create tool documentation in README or MODE_GUIDE or smth
- [ ] More relaxed todo format in the plugin


- [ ] Fajniejszy tutorial dotyczący klucza antropica i openai
- [ ] User guide requires a cleanup
- [ ] Choose licence
- [ ] Add plugin to obsidian repository
- [ ] Create discord server
- [ ] Create a presentation for AI breakfast
- [ ] Write a draft blog post for people to read through and give feedback on

## Initial release
- [ ] Lepszy entry level experience
- [ ] 📝 Asystentka - Zachowywać dokładnie oryginalne sformułowania użytkownika bez robienia rephrasingów
- [ ] Pouzupełnianie brakujących translacji
- [ ] Upewnienie się że AI rozumiem ze [-] to anulowany task
- [ ] Disable show todo for now
- [ ] Naprawić w life navigatorze:
```markdown
❌ Nie znaleziono zadania ""🍳 10:30 Śniadanie z Michałem"" w {{path}}. Jeśli zadanie znajduje się w innym pliku, określ go w parametrze file_path.
```

- [ ] I made a marketing plan of the Vibe Living project

## Nice to haves

- [ ] 🐛 Naprawić problem automatycznego dodawania niepotrzebnych komentarzy


- [ ] Bug gdy zastopuje generowanego tool calla
- [ ] Dodać możliwość konfiguracjii tooli w trybach


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
- [ ] point of insertion should be after the last completed task, not before the first uncompleted one
