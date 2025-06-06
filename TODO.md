# TODO


# Stages
- [ ] https://github.com/obsidianmd/obsidian-releases/pull/6517
- [ ] Onboard 5 people to the plugin
- [ ] Plan for promotion
- [ ] Create an onboarding video in english
- [ ] Start promoting the plugin on obsidian channels
- [ ] Communication: I'm not gathering data therfore I need your engagement and activelly telling me feedback and stories how your onboarding went, how you use it.

# Promo
- [ ] Write a draft blog post for people to read through and give feedback on
- [ ] 📈 Develop marketing concept "All you need is markdown" - emphasizing that Life Navigator doesn't need a database
- [ ] Article about wiki paradigm as markdown database (creating/using input output not chats and rag, AI helping with this)

## Nice to haves
- [ ] What happens if I write a string when there supposed to be an integer etc in modes frontmatter?
- [ ] Maybe this tool management for modes? based on tags? and a specific ui interface for editing the mode? With prebuild modes having read only ui? Maybe this ui should allow to edit all settings of the mode?
- [ ] Scanning periodically for updates
- [ ] Basic google search tool would be nice to have - https://docs.firecrawl.dev/features/search
- [ ] 📎 Dodać obsługę załączników plików (nie tylko obrazków) w czacie Life Navigatora - PDFy automatycznie konwertować na tekst, drag & drop zarówno z systemu plików jak i wewnętrznie z Obsidiana
- [ ] Scan for useful shit that we can add from general obsidian knowledge base
    - [ ] Import z notion: https://www.notion.com/help/export-your-content
- [ ] url-downloader should convert the result to markdown and be highly resilient to various schemes of providing content from url (firecrawl?)
- [ ] Audio seems to have gotten slower recently
- [ ] 🤔 Zbadać i zaimplementować włączanie/wyłączanie thinking blocks w Life Navigatorze - sprawdzić czy Anthropic przyjmie usunięcie thinking blocków
- [ ] When there is no api key or there is a x-api error, instead of Notification a special error message should be added to the chat.
- [ ] Any other tools should be user tools?
- [ ] Proper mature user defined calendar tool
- [ ] Do I want to be able to download any file from the repository?
- [ ] Prompt caching for anthropic
- [ ] Introduce support for weekly and monthly summaries via ln-monthly-note and ln-weekly-note.
- [ ] checking for updates via tool not from settings
- [ ] Can I have more granular styles.css?
- [ ] Proper management of available tools for modes.
- [ ] System prompt injection into TTS prompt via current chat expansion? also refactor the way current chat information is gathered.
- [ ] Better info dumped to AI when file is not found in expand links
- [ ] still there is something wrong with the current spot logic - is it still a problem?
- [ ] Create tool documentation in README or MODE_GUIDE or smth
- [ ] Do I want the input buttons to be flat?
- [ ] 🔧 Dodać do promptów systemowych Life Navigatora informacje o autorze - social media, możliwość wsparcia, gdzie śledzić
    Co warto dodać do promptów:
    - Social media: LinkedIn (@mcielecki), X.com (@mcielecki), GitHub (@cielecki)
    - Discord Life Navigator community (link do zaproszenia)
    - Jak wspierać projekt: GitHub stars, contributions, feedback, testing
    - Kim jestem: CEO 10Clouds → indie open source creator, AI enthusiast
    - Life Navigator to open source, privacy-first personal AI companion
    - Link do strony projektu (gdy będzie gotowa)
    - Zachęta do dzielenia się projektem z innymi
    - Możliwość zgłaszania bugów i feature requests na GitHub
- [ ] 🔍 Zaimplementować fuzzy search dla zadań w Life Navigatorze - gdy nie znajdzie dokładnego tekstu zadania, zaproponować podobne opcje
    **Problem:** Gdy próbujesz odfajczyć zadanie i tekst się nie zgadza 100%, dostajesz błąd "nie znaleziono".
    **Rozwiązanie:** Fuzzy search który znajdzie podobne zadania i zaproponuje wybór z najbardziej prawdopodobnych.
    **Algorytm:** Podobieństwo tekstu, dopasowanie słów kluczowych, edycyjna odległość.