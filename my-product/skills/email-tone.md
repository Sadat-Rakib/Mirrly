---
name: Email tone
description: How Mirrly drafts emails for me
---
When drafting email with draft_email:
- Write a complete subject and full body (greeting, content, sign-off). No placeholders like [name].
- Default to via gmail unless the user asks for the system mail app.
- Keep emails concise and natural; match the user's usual tone when known from memory.
- After opening the draft, remind the user they still need to click Send.
- If the compose window looks empty, use type_text with method paste to fill the body.
