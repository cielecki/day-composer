# TODO

## Release to familiy and friends
- [x] rename day-note to ln-day-note ...
- [x] Take few days off to release this
- [x] ln-current-date-and-time link that generates information about current time
- [x] Starter kit translations
- [x] Add task backlog to stater kit
- [x] Removed ln_voice_speed from starter kit as mini tts does not support it
- [x] fixed example usages so more of them are visible
- [x] Is the domain free? no
- [x] Test with N
- [x] Update checker should refresh obsidian

- [ ] Fix transcription issues
- [ ] Name of the modes should come from file name not ln_name
- [ ] Working daily planning and habits in the starter kit
- [ ] ln-current-open-file w speech to text
- [ ] ln-current-chat in speech to text?

- [ ] Test with B
- [ ] Test with Piotr

- [ ] Modes are not translated to english

## AI breakfast release
- [ ] 🔧 Dodać funkcję edycji todo itemów
- [ ] Fajniejszy tutorial dotyczący klucza antropica i openai

- [ ] Choose licence
- [ ] Add plugin to obsidian repository
- [ ] Create discord server
- [ ] Create a presentation for AI breakfast
- [ ] Write a draft blog post for people to read through and give feedback on
- [ ] Write down the obsidian bullet journal md format that the plugin uses
- [ ] Create tool documentation in README or MODE_GUIDE or smth
- [ ] More relaxed todo format in the plugin
- [ ] Styling for non dark mode users is off
- [ ] Why are mobile styles completely different and there's a contrast issue?

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
- [ ] point of insertion should be after the last completed task, not before the first uncompleted one
