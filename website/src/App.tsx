import { useEffect, useState } from 'react'
import { motion } from 'motion/react'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="lg1" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="0.52" stopColor="#3C83F5" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id="lg2" x1="24" y1="2" x2="24" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.65" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#lg1)" />
      <rect x="3" y="3" width="42" height="42" rx="12.2" fill="none" stroke="url(#lg2)" strokeWidth="1.6" />
      <path
        d="M14 30.5V19.8c0-1.05 1.27-1.57 2-.83l7.15 7.32a1.2 1.2 0 0 0 1.7 0L32 18.97c.73-.74 2-.22 2 .83V30.5"
        stroke="#FFFFFF"
        strokeWidth="3.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 35.6c2.7 1.6 5.8 2.5 9 2.5s6.3-.9 9-2.5"
        stroke="#FFFFFF"
        strokeOpacity="0.5"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TypingMessages() {
  const messages = ['Stuck on this?', 'I got you.', 'On it.']
  const [msgIndex, setMsgIndex] = useState(0)
  const [text, setText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const current = messages[msgIndex]
    let timer: ReturnType<typeof setTimeout>
    if (!deleting && text.length < current.length) {
      timer = setTimeout(() => setText(current.slice(0, text.length + 1)), 100)
    } else if (!deleting && text.length === current.length) {
      timer = setTimeout(() => setDeleting(true), 2000)
    } else if (deleting && text.length > 0) {
      timer = setTimeout(() => setText(current.slice(0, text.length - 1)), 50)
    } else if (deleting && text.length === 0) {
      setDeleting(false)
      setMsgIndex((i) => (i + 1) % messages.length)
    }
    return () => clearTimeout(timer)
  }, [text, deleting, msgIndex])

  return (
    <div className="absolute left-[48.5%] md:left-[47.5%] lg:left-[48.5%] -translate-x-1/2 bottom-[32%] z-30 w-[110px] sm:w-[130px] flex justify-start text-left">
      <span className="font-nokia text-[#2A3616] text-[10px] sm:text-[14px] leading-tight break-words min-h-[1.5em]">
        {text}
        <motion.span
          className="inline-block w-1.5 h-3 bg-[#2A3616] ml-1 align-middle"
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
      </span>
    </div>
  )
}

const WINDOWS_DOWNLOAD =
  'https://github.com/Sadat-Rakib/Mirrly/releases/latest/download/Mirrly-Setup.exe'

function Navbar() {
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 w-[95%] max-w-5xl z-50 pointer-events-none">
      <nav className="pointer-events-auto flex items-center justify-between backdrop-blur-md rounded-full border border-black/10 bg-white/20 px-5 py-2.5">
        <a href="#" className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="font-instrument text-[28px] tracking-tight text-[#1a1a1a]">Mirrly</span>
        </a>
        <a
          href="#about"
          className="font-sans text-[14px] text-[#1a1a1a] hover:opacity-60 transition-opacity"
        >
          About
        </a>
        <a
          href={WINDOWS_DOWNLOAD}
          className="group relative overflow-hidden bg-[#0871E7] rounded-full text-white font-sans text-[14px] px-5 py-2 shadow-[inset_0_-4px_4px_rgba(255,255,255,0.39)] outline-1 outline-[#0871E7] -outline-offset-1"
        >
          <span className="absolute w-[80%] h-4 left-[10%] top-[1px] bg-gradient-to-b from-[#DEF0FC] to-transparent rounded-[12px] transition-transform group-hover:scale-x-105" />
          <span className="relative">Get Mirrly</span>
        </a>
      </nav>
    </div>
  )
}

function WindowsGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M3 5.5 10.5 4.4v7.1H3V5.5zm0 13 7.5 1.1v-7H3v5.9zM11.5 4.25 21 3v8.5h-9.5v-7.25zm0 15.5L21 21v-8.5h-9.5v7.25z" />
    </svg>
  )
}

function DownloadPills() {
  return (
    <motion.div
      id="download"
      className="pointer-events-auto absolute left-[42%] sm:left-[43%] md:left-[44%] lg:left-[45%] -translate-x-1/2 bottom-[2%] sm:bottom-[2.5%] md:bottom-[3%] z-40 flex flex-col items-center gap-2.5 w-[min(92vw,300px)]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, delay: 0.55, ease: EASE }}
    >
      <a
        href={WINDOWS_DOWNLOAD}
        className="liquid-glass-strong flex items-center gap-2.5 rounded-full px-6 py-3 font-sans text-[14px] font-medium text-[#1a1a1a] transition-transform hover:scale-[1.03] active:scale-[0.98] shadow-lg"
      >
        <WindowsGlyph />
        Download for Windows
      </a>
      <p className="font-sans text-[12px] sm:text-[13px] leading-snug text-[#1a1a1a] text-center bg-white/90 border border-black/10 rounded-2xl px-3.5 py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
        Windows may say the publisher is unknown. That&apos;s not on you. A proper
        signing certificate costs around $500 a year, so this open-source build
        isn&apos;t signed yet. Click <span className="font-semibold">Keep anyway</span>,
        then <span className="font-semibold">Run</span>.
      </p>
    </motion.div>
  )
}

function Hero() {
  return (
    <section className="relative min-h-screen bg-[#F3F4ED] pt-24 md:pt-32 flex flex-col items-center overflow-hidden">
      <video
        className="absolute inset-0 z-0 w-full h-full object-cover"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260427_054418_a6d194f0-ac86-4df9-abe5-ded73e596d7c.mp4"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="absolute inset-0 z-10 bg-white/5" />

      <div className="relative z-20 pointer-events-none text-center px-6 pb-[42vh] sm:pb-[44vh] md:pb-[46vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: EASE }}
        >
          <h1 className="font-instrument text-[38px] md:text-[56px] lg:text-[72px] leading-[0.85] tracking-tight text-[#1a1a1a] mb-6">
            Stays with you.
            <br />
            Gets your world.
          </h1>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.3, ease: EASE }}
        >
          <p className="font-sans text-[16px] md:text-[18px] text-[#1a1a1a]/80 leading-relaxed font-normal max-w-xl mx-auto drop-shadow-[0_1px_8px_rgba(255,255,255,0.85)]">
            Everyone&apos;s juggling too much at once. Mirrly is an AI assistant
            on your desktop that looks at what you&apos;re working on, helps when
            you ask, and keeps up with the mess of the day.
          </p>
        </motion.div>
      </div>

      <DownloadPills />
      <TypingMessages />
    </section>
  )
}

const FEATURES = [
  {
    title: 'Help with what’s on screen',
    body: 'Stuck on a doc, some code, or an error? Ask Mirrly — type it or just dictate with the mic. It explains in plain language, drafts replies, translates, or works through the problem with you.',
  },
  {
    title: 'Help on calls too',
    body: 'Turn on listening when you want. Mirrly can keep up with the conversation, suggest what you might say next, and turn it into notes with action items afterward.',
  },
  {
    title: 'Actually gets things done',
    body: 'It researches the web, opens apps and websites, drafts complete emails, can type into the window in front of you, and remembers facts locally — plus Skills so you can teach it how you like things done.',
  },
  {
    title: 'Or pick a mascot',
    body: 'Not a pill person? Switch on mascot mode in Settings and choose Cat, Dog, Fox, or Bunny — a little companion that wanders your desktop. Click it whenever you want to talk. Voice mode lets you keep talking hands-free.',
  },
]

function WhatIsMirrly() {
  return (
    <section id="features" className="relative bg-[#F3F4ED] pb-28 pt-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 1, ease: EASE }}
          className="text-center mb-14"
        >
          <h2 className="font-instrument text-[34px] md:text-[48px] tracking-tight leading-[0.95] text-[#1a1a1a] mb-4">
            What is Mirrly?
          </h2>
          <p className="font-sans text-[16px] md:text-[17px] text-[#1a1a1a]/70 leading-relaxed max-w-2xl mx-auto">
            I can’t give everyone a real human assistant, but I can try to build
            a useful AI one. Mirrly sits on your desktop, looks at the moment
            you’re in, and helps with the next step. Not magic. Just handy.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.9, delay: i * 0.12, ease: EASE }}
              className="liquid-glass rounded-[28px] p-8 text-left"
            >
              <h3 className="font-instrument text-[24px] text-[#1a1a1a] mb-3 tracking-tight">
                {f.title}
              </h3>
              <p className="font-sans text-[14.5px] leading-relaxed text-[#1a1a1a]/70">
                {f.body}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          id="your-keys"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.9, ease: EASE }}
          className="liquid-glass rounded-[28px] px-8 py-7 mt-5 flex flex-col md:flex-row items-center gap-6 md:gap-10"
        >
          <div className="flex-1 text-left">
            <h3 className="font-instrument text-[24px] text-[#1a1a1a] mb-2 tracking-tight">
              Bring your own AI key
            </h3>
            <p className="font-sans text-[14.5px] leading-relaxed text-[#1a1a1a]/70">
              No Mirrly account to create. Paste a key from OpenAI, Anthropic,
              Gemini, Groq, OpenRouter, or another OpenAI-style provider. Or start
              with Pollinations and skip the key entirely. Your stuff stays on
              your computer.
            </p>
          </div>
          <a
            href={WINDOWS_DOWNLOAD}
            className="group relative overflow-hidden shrink-0 bg-[#0871E7] rounded-full text-white font-sans text-[14px] px-6 py-3 shadow-[inset_0_-4px_4px_rgba(255,255,255,0.39)] outline-1 outline-[#0871E7] -outline-offset-1"
          >
            <span className="absolute w-[80%] h-4 left-[10%] top-[1px] bg-gradient-to-b from-[#DEF0FC] to-transparent rounded-[12px] transition-transform group-hover:scale-x-105" />
            <span className="relative">Get Mirrly free</span>
          </a>
        </motion.div>
      </div>
    </section>
  )
}

function GitHubIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.486 2 12.02c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.866-.013-1.7-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.071 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.026 2.747-1.026.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.31.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.02C22 6.486 17.523 2 12 2z" />
    </svg>
  )
}

function Footer() {
  return (
    <footer id="about" className="bg-[#F3F4ED] border-t border-black/5 py-10 px-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Logo size={24} />
          <span className="font-instrument text-[22px] tracking-tight text-[#1a1a1a]">Mirrly</span>
        </div>
        <p className="font-sans text-[13px] text-[#1a1a1a]/65 text-center">
          Open source under GPL-3.0. Bring your own key. Built for Windows.
        </p>
        <a
          href="https://github.com/Sadat-Rakib/Mirrly"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          className="text-[#1a1a1a]/70 hover:text-[#1a1a1a] transition-colors"
        >
          <GitHubIcon />
        </a>
      </div>
    </footer>
  )
}

export default function App() {
  return (
    <div className="font-sans">
      <Navbar />
      <Hero />
      <WhatIsMirrly />
      <Footer />
    </div>
  )
}
