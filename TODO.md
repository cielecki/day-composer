# TODO

- [x] When I start up the english version I have some problems with translation packs
- [x] Test the final release
- [x] Create a presentation for AI breakfast
- [x] Calendly link with QR code?
- [x] Do a presentation
- [x] 🤖 Add ability to switch from Opus to Sonnet in Obsidian

- [ ] Acquire as many test users as possible, talk to them, setup calls for calendly
- [ ] Plan for whats next

## Nice to haves

- [ ] Import z notion: https://www.notion.com/help/export-your-content lub https://anytype.io
- [ ] Presentation concept - finding people who want to explore this, see if it's useful for them
- [ ] 📈 Develop marketing concept "All you need is markdown" - emphasizing that Life Navigator doesn't need a database
- [ ] Article about wiki paradigm as markdown database (creating/using input output not chats and rag, AI helping with this)
- [ ] Write a draft blog post for people to read through and give feedback on
- [ ] How to create guidance for users when creating their materials? Some nice mode? or docs?
- [ ] Better info dumped to AI when file is not found in expand links
- [ ] still there is something wrong with the current spot logic - is it still a problem?
- [ ] If I record during generation the stop button is becoming unresponsive
- [ ] Do I want the input buttons to be flat?
- [ ] When stopping audio during eneration, something breaks and it's not being stopped, furthermoe when it starts playing the stop button is not working
- [ ] ⚡ Quick mode in Obsidian - describe what it is (ability to cancel speech for example, pending message etc)
- [ ] Test with B
- [ ] Test with Piotr
- [ ] AI Coach -> Life Navigator
- [ ] Tool for creating images using OpenAI image generation that pastes the image into the current note
- [ ] Clickable tool calls so they open the editor
- [ ] 🔧 No action buttons on text messages ending with a tool call?
- [ ] Bug when stopping generated tool call
```markdown
conversation turn processing: BadRequestError: 400 {"type":"error","error":{"type":"invalid_request_error","message":"messages.4: `tool_use` ids were found without `tool_result` blocks immediately after: toolu_016aY9VAzzsaK6mWENg3JN8L. Each `tool_use` block must have a corresponding `tool_result` block in the next message."}}
    at _APIError.generate (plugin:day-composer:48107:14)
    at Anthropic.makeStatusError (plugin:day-composer:48883:21)
    at Anthropic.makeRequest (plugin:day-composer:48928:24)
    at async eval (plugin:day-composer:51631:28)
    at async eval (plugin:day-composer:51802:49)
```
- [ ] 🐛 Fix the problem of automatically adding unnecessary comments - is this still a problem?
- [ ] Better design for message editing on mobile because when the keyboard pops up you can't do anything - there's very little vertical space
- [ ] Better error when there's no Anthropic API
- [ ] Better tutorial regarding Anthropic and OpenAI keys
- [ ] Create tool documentation in README or MODE_GUIDE or smth
- [ ] There are still some issues with handing over modes, should I disable this feature or fix it?
