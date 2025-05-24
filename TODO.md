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
- [x] 🔄 Wprowadź zapamiętywanie aktualnego trybu pomiędzy uruchomieniami w Obsidianie
- [x] Styling for non dark mode users is off
- [x] Spinner when transcribing has some opacity or color issue
- [x] Why are mobile styles completely different and there's a contrast issue?
- [x] Distinct animation for when speech is being generated vs when it's playing
- [x] point of insertion should be after the task preceeding the first uncompleted one (so any text in between should follow the inserted task)
- [x] Waveform when I enable it for the second time, it seems to very briefly show either old data or some noise - non empty waveform - this needs to be fixed
- [x] handover tool do innych trybów
- [x] Naprawić w life navigatorze:
```markdown
❌ Nie znaleziono zadania ""🍳 10:30 Śniadanie z Michałem"" w {{path}}. Jeśli zadanie znajduje się w innym pliku, określ go w parametrze file_path.
```
- [x] abandoning powinien przenosić zadania na początek notatki dla lepszej widoczności
- [x] Dodać możliwość konfiguracjii tooli w trybach
- [x] Life navigator: comments jak sa multiline to zle sie formatuja po dodaniu do notatki przez AI
- [x] Fix styling of main chat - borders and backgrounds
- [x] More relaxed todo format

- [ ] Format of the todo items should be refered to somewhere in prompts - write down the obsidian bullet journal md format that the plugin uses
- [x] 🔧 Edit todo items
- [x] Add function to delete tasks (putting them in a comment)
- [ ] Defaulting not to todays log but to currently open file, or maybe just don't do defaults at all.

--------------------------------

- [ ] Working daily planning and habits in the starter kit
- [ ] Test with G
- [ ] Test with Piotr
- [ ] Acquire as many test users as possible
- [ ] Gandi and other updates to personas and prompts
- [ ] Modes are not translated to english
- [ ] 📝 Asystentka - Zachowywać dokładnie oryginalne sformułowania użytkownika bez robienia rephrasingów
- [ ] 🐛 Naprawić problem automatycznego dodawania niepotrzebnych komentarzy

## AI breakfast release

- [ ] Create tool documentation in README or MODE_GUIDE or smth

- [ ] Fajniejszy tutorial dotyczący klucza antropica i openai
- [ ] User guide requires a cleanup
- [ ] Choose licence
- [ ] Add plugin to obsidian repository
- [ ] Create discord server
- [ ] Create a presentation for AI breakfast
- [ ] Write a draft blog post for people to read through and give feedback on

## Initial release
- [ ] still there is something wrong with the current spot logic
- [ ] Starter kit should be created even if a directory like this already exists (it should just be created under a new name (like starter kit 2 or smth))
- [ ] Better info dumped to AI when file is not found in expand links

- [ ] Bug gdy zastopuje generowanego tool calla
```markdown
conversation turn processing: BadRequestError: 400 {"type":"error","error":{"type":"invalid_request_error","message":"messages.4: `tool_use` ids were found without `tool_result` blocks immediately after: toolu_016aY9VAzzsaK6mWENg3JN8L. Each `tool_use` block must have a corresponding `tool_result` block in the next message."}}
    at _APIError.generate (plugin:day-composer:48107:14)
    at Anthropic.makeStatusError (plugin:day-composer:48883:21)
    at Anthropic.makeRequest (plugin:day-composer:48928:24)
    at async eval (plugin:day-composer:51631:28)
    at async eval (plugin:day-composer:51802:49)
```

- [ ] If I record during generation the stop button is becoming unresponsive
- [ ] Do I want the input buttons to be flat?
- [ ] When stopping audio during eneration, something breaks and it's not being stopped, furthermoe when it starts playing the stop button is not working
- [ ] Lepszy entry level experience

- [ ] Upewnienie się że AI rozumiem ze [-] to anulowany task
- [ ] Disable show todo for now
- [ ] I made a marketing plan of the Vibe Living project

## Nice to haves
- [ ] Test with B
- [ ] AI Coach -> Life Navigator


