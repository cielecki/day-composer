# TODO

- [ ] Generate image should be a user tool
- [ ] user tools should have a version attribute
- [ ] Proper mature user defined calendar tool 
- [ ] Deep research should be a user tool
- [ ] Any other tools should be user tools?
- [ ] Wrap up and prepare the user tools feature for release
- [ ] **AI-Assisted Knowledge Base Editing:** Explore functionality for the AI to directly suggest or make additions/modifications to the user's core knowledge files (e.g., `About Me.md`, `Relationships.md`) based on conversations or insights. The user need is to streamline the process of updating personal context, allowing the AI to help maintain and expand the knowledge base it uses.
- [ ] **Interactive Creator Mode:** How to create guidance for users when creating their materials? Some nice mode? or docs? Maybe a tutorial agent? Create a creator mode that generates sections/files based on dialogue with the user instead of using standard starter kits. This would provide a more personalized and interactive setup experience. Maybe this should allow for downloading files from github based on needs of the user.
- [ ] **Asset repository:** Create a repository of assets that can be used in the plugin and can be downloaded by the creation agent.

There should be an assets.json file in the repository that the plugin downloads, the structure of assets.json:

{
    "assets": [
        {
            "name": "asset1",
            "type": "tool | mode | note",
            "hash": "1234567890"
            "url": "https://example.com/asset1.md"
            
        },
        {
            "name": "Example Asset",
            "type": "note",
            "hash": "1234567890"
            "url": "https://example.com/example.md"
        }
    ]
}

The main Life Navigator mode should have tools to search this assets repository and download assets - and get them as a result of the tool call. Those assets should be strictly english and the agent should be repsonsible for translating them to the language of the user and adjusting them for user's needs before saving them to the user's vault. It's also possible that the agent will download few sample modes or toools and then create a completly new asset based on them.

Maybe this does not have to be json as it will be interpreted by AI anyway. it could be a markdown doc.

# Stages
- [ ] Onboard 5 people to the plugin
- [ ] Plan for promotion
- [ ] Create an onboarding video in english
- [ ] Start promoting the plugin on obsidian channels

# Promo
- [ ] Write a draft blog post for people to read through and give feedback on
- [ ] 📈 Develop marketing concept "All you need is markdown" - emphasizing that Life Navigator doesn't need a database
- [ ] Article about wiki paradigm as markdown database (creating/using input output not chats and rag, AI helping with this)

## Nice to haves
- [ ] Introduce support for weekly and monthly summaries via ln-monthly-note and ln-weekly-note.
- [ ] Creator prototype
- [ ] Change the link emoji to 🧭?
- [ ] Can I have more granular styles.css?
- [ ] Proper management of available tools for modes.
- [ ] System prompt injection into TTS prompt via current chat expansion? also refactor the way current chat information is gathered.
- [ ] Better info dumped to AI when file is not found in expand links- [ ] still there is something wrong with the current spot logic - is it still a problem?
- [ ] Create tool documentation in README or MODE_GUIDE or smth
- [ ] 🔧 No action buttons on text messages ending with a tool call?
- [ ] Do I want the input buttons to be flat?
- [ ] Import z notion: https://www.notion.com/help/export-your-content lub https://anytype.io
