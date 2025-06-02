# TODO

- [x] In the setup the input to paste into for antropic and openai keys IS VERY SMALL compared to other things that draw attention, can you redesign those screens to be simpler and more to the point, centered around the input that you are pasting into? Remove old css after you are done modifying this.
- [x] In the initial setup screen the language text is waaay too long
- [ ] Jak robiłem kolejną transkrypcje podczas generacji coś się walneło, chyba ostatnie zmiany popsuły w tym zakresie coś.
- [ ] Wrap up and prepare the user tools feature for release
- [ ] **AI-Assisted Knowledge Base Editing:** Explore functionality for the AI to directly suggest or make additions/modifications to the user's core knowledge files (e.g., `About Me.md`, `Relationships.md`) based on conversations or insights. The user need is to streamline the process of updating personal context, allowing the AI to help maintain and expand the knowledge base it uses.
- [ ] **Interactive Creator Mode:** How to create guidance for users when creating their materials? Some nice mode? or docs? Maybe a tutorial agent? Create a creator mode that generates sections/files based on dialogue with the user instead of using standard starter kits. This would provide a more personalized and interactive setup experience. Maybe this should allow for downloading files from github based on needs of the user.
- [ ] Less invasive startup kit materials
- [ ] Encrypted secrets storage?
- [ ] ln-tool vs ln_description in mode, would be good to create a coherent naming scheme for those attributes


> ### Required
> [[1](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/settings/SettingsTab.ts#L32)][[2](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/settings/SettingsTab.ts#L46)][[3](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/settings/SettingsTab.ts#L63)][[4](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/settings/SettingsTab.ts#L70)][[5](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L405)][[6](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L439)][[7](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L444)][[8](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L449)][[9](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/LucideIcon.tsx#L29)]:Using `innerHTML`, `outerHTML` or similar API's is a security risk. Instead, use the DOM API or the Obsidian helper functions: https://docs.obsidian.md/Plugins/User+interface/HTML+elements
> 
> [[1](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/tools/utils/getDailyNotesSettings.ts#L14)]:Obsidian's configuration directory isn't necessarily `.obsidian`, it can be configured by the user. You can access the configured value from `Vault#configDir`
> 
> [[1](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L42)][[2](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L43)][[3](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L44)][[4](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L45)][[5](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L46)][[6](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L47)][[7](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L48)][[8](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L49)][[9](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L52)][[10](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L469)][[11](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L470)][[12](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L495)][[13](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L496)][[14](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L522)][[15](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L523)][[16](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L562)][[17](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L563)][[18](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L617)][[19](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L618)][[20](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/UnifiedInputArea.tsx#L123)][[21](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/UnifiedInputArea.tsx#L124)][[22](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/UnifiedInputArea.tsx#L129)][[23](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/UnifiedInputArea.tsx#L130)][[24](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/UnifiedInputArea.tsx#L150)][[25](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/UnifiedInputArea.tsx#L151)][[26](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/UnifiedInputArea.tsx#L321)][[27](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/UnifiedInputArea.tsx#L351)][[28](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/UnifiedInputArea.tsx#L352)]:You should avoid assigning styles via JavaScript or in HTML and instead move all these styles into CSS so that they are more easily adaptable by themes and snippets.
> 
> [[1](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/AICoachApp.tsx#L464)]:You should not cast this, instead use a `instanceof` check to make sure that it's actually a file/folder.
> 
> [[1](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/i18n.ts#L9)][[2](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/i18n.ts#L20)][[3](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/i18n.ts#L41)][[4](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L41)][[5](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L44)][[6](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L374)][[7](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L387)][[8](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L392)][[9](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L402)][[10](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L405)][[11](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L422)][[12](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L432)][[13](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L438)][[14](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L439)][[15](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L489)][[16](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L497)][[17](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L513)][[18](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L529)][[19](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L536)][[20](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L540)][[21](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/obsidian-tools.ts#L107)][[22](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/obsidian-tools.ts#L127)][[23](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/obsidian-tools.ts#L159)][[24](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/obsidian-tools.ts#L165)][[25](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/defaults/ln-mode-defaults.ts#L86)][[26](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/main.ts#L218)][[27](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/main.ts#L267)][[28](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/main.ts#L341)][[29](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/main.ts#L358)][[30](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/main.ts#L362)] and more :You should consider limiting the number of `console.log`s in your code, to not pollute the dev console.
> 
> ### Optional
> [[1](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context-collector.ts#L522)][[2](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/MessageDisplay.tsx#L57)][[3](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/MessageDisplay.tsx#L223)][[4](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/components/UnifiedInputArea.tsx#L235)][[5](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/context/AIAgentContext.tsx#L146)][[6](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/tools/show-todos.ts#L251)][[7](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/tools/show-todos.ts#L284)][[8](https://github.com/cielecki/life-navigator/blob/c43a0dd7131c099e9daa510002d3443ef77189a8/src/tools/show-todos.ts#L317)]:Casting to `any` should be avoided as much as possible.
> 
> Do NOT open a new PR for re-validation. Once you have pushed all of the required changes to your repo, the bot will update the labels on this PR within 6 hours. If you think some of the required changes are incorrect, please comment with `/skip` and the reason why you think the results are incorrect.
- [ ] Proper mature user defined calendar tool 
- [ ] Any other tools should be user tools?

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
