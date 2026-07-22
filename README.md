# Mirrly

A small AI helper that sits on your Windows desktop.

[Download for Windows](https://github.com/Sadat-Rakib/Mirrly/releases) · [License (GPL-3.0)](LICENSE)

## Watch it

![Mirrly on a real Windows desktop](docs/Mirrly-demo.webp)

[Full video](docs/Mirrly.mp4)

## Why this exists

Everyone around me was drowning in tabs, docs, calls, and half-finished thoughts. I can’t give people a real assistant. So I built a small one that lives on the desktop and helps with what’s in front of you.

That’s Mirrly. It’s not magic. It’s just handy.

## What it can do

Mirrly floats over your other apps. You use your own AI key (or start with Pollinations, which needs no key).

It can:

- Look at your screen and help explain, write, or fix something
- Listen on a call (if you allow the mic) and help with what to say or meeting notes
- Open apps for you — like “open notepad” or “open Spotify”
- Open websites — like “open YouTube” or “open Gmail”
- Draft an email for you (you still click **Send**)
- Look things up on the real web instead of guessing
- Remember facts you ask it to keep, on your own computer
- Talk with you in voice mode (hands-free)
- Learn your preferences through simple skill files
- Turn into a little cat, dog, fox, or bunny if you want something cuter than a pill

## How to install

1. Go to [Releases](https://github.com/Sadat-Rakib/Mirrly/releases)
2. Download **Mirrly-Setup.exe**
3. Run it

Windows may say the publisher is unknown. That’s normal for an unsigned open source app. Click **Keep anyway**, then **Run**.

There’s also a portable `.exe` if you don’t want an installer.

## First time setup

1. Mirrly opens as a small panel on your desktop
2. Follow the short walkthrough (click the logo anytime to see it again)
3. Open Settings with `Ctrl` + `,`
4. Paste an API key, or leave Pollinations on to try it with no key

**Quick tip:** Pollinations needs no key, but it can’t see your screen well. A free Gemini, Groq, or OpenRouter key works much better.

For listening, dictation, and voice mode, you’ll need a Groq or Gemini key for speech-to-text.

## Everyday use

Leave Mirrly open while you work. It stays on top.

| Want to… | Do this |
|---|---|
| Get help with what’s on screen | `Ctrl` + `Enter` |
| Explain what’s on screen | `Ctrl` + `E` |
| Solve a problem on screen | `Ctrl` + `H` |
| Ask anything | Type and press Enter |
| Dictate instead of typing | Mic next to Send |
| Talk hands-free | Waveform button in the top bar |
| Listen to a call | Mic in the top bar |
| Open Settings | `Ctrl` + `,` |
| Quit | `Ctrl` + `Shift` + `X` |

Try saying things like:

- “open notepad”
- “open youtube”
- “email alex@example.com about tomorrow’s meeting”

Your keys and memory stay in a local file on your PC (`mirrly-data.json`). Mirrly doesn’t run a server of its own.

## Skills (optional)

Skills are short text files that teach Mirrly how you like things done — email tone, how bold it should be with desktop actions, and so on.

Open Settings → Skills to turn them on or off, or click **Open skills folder** and edit the `.md` files yourself.

## Run from source

Need Node.js 18+.

```bash
git clone https://github.com/Sadat-Rakib/Mirrly.git
cd Mirrly/my-product
npm install
npm start
```

Build the Windows installer:

```bash
npm run dist:win
```

Website (optional):

```bash
cd website
npm install
npm run dev
```

## What’s inside (for developers)

- Desktop app: Electron + plain HTML/CSS/JS (`my-product/`)
- Website: React + Vite (`website/`)
- Your choice of AI provider: Pollinations, OpenAI, Anthropic, Gemini, Groq, OpenRouter, or a custom endpoint

The important code lives in `my-product/main.js`, `my-product/renderer/`, and `my-product/src/`.

## Contributing

Issues and PRs are welcome. Keep the desktop app easy to read. This project is GPL, so contributions need to stay GPL-compatible.

## License

[GNU GPL v3 or later](LICENSE).

You can use it, change it, and share it. If you ship Mirrly or a modified version, it has to stay open source under the GPL.
