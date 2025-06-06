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
- [ ] Maybe todo tools should support better a rich text format of the entire daily note? maybe they should be less rigid?
- [ ] Maybe daily notes should be a tool call instead of ln-day-note?
- [ ] Maybe current open file editor content and selected text should also be tool calls? (GOOD IDEA)
- [ ] What happens if I write a string when there supposed to be an integer etc in modes frontmatter?
- [ ] Maybe this tool management for modes? based on tags? and a specific ui interface for editing the mode? With prebuild modes having read only ui? Maybe this ui should allow to edit all settings of the mode?
- [ ] Scanning periodically for updates
- [ ] Basic google search tool would be nice to have - https://docs.firecrawl.dev/features/search
- [ ] 📎 Add support for file attachments (not just images) in Life Navigator chat - automatically convert PDFs to text, drag & drop from both file system and internally from Obsidian
- [ ] Scan for useful shit that we can add from general obsidian knowledge base
    - [ ] Import z notion: https://www.notion.com/help/export-your-content
- [ ] url-downloader should convert the result to markdown and be highly resilient to various schemes of providing content from url (firecrawl?)
- [ ] Audio seems to have gotten slower recently
- [ ] 🤔 Research and implement enabling/disabling thinking blocks in Life Navigator - check if Anthropic will accept removal of thinking blocks
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
- [ ] 🔧 Add author information to Life Navigator system prompts - social media, support options, where to follow
    What's worth adding to prompts:
    - Social media: LinkedIn (@mielecki), X.com (@mcielecki), GitHub (@cielecki)
    - Discord Life Navigator community (invitation link)
    - How to support the project: GitHub stars, contributions, feedback, testing
    - Who I am: CEO 10Clouds → indie open source creator, AI enthusiast
    - Life Navigator is open source, privacy-first personal AI companion
    - Project website link (when ready)
    - Encourage sharing the project with others
    - Ability to report bugs and feature requests on GitHub
- [ ] 🔍 Implement fuzzy search for tasks in Life Navigator - when exact task text isn't found, suggest similar options
    **Problem:** When trying to check off a task and the text doesn't match 100%, you get a "not found" error.
    **Solution:** Fuzzy search that finds similar tasks and suggests the most likely choices.
    **Algorithm:** Text similarity, keyword matching, edit distance