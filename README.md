# WhatsApp Focus Lock

A Chrome extension that helps you stop compulsively checking WhatsApp Web while studying, by limiting how long you can use it and locking it for a cooldown period once your time is up.

## Why

Checking WhatsApp "just in case someone texted" is one of the easiest ways to break focus during study sessions. This extension adds friction: once your allowed time is used, WhatsApp Web locks itself for a set cooldown, so you can't just reopen it a minute later.

## Features

- **Session timer** – Set how many minutes of WhatsApp Web you get before it locks (e.g. 10 minutes).
- **Cooldown lock** – Once your session runs out, WhatsApp Web is locked for a duration you choose (30 min, 1 hr, 2 hrs, or any custom time).
- **Daily limit** – A total time cap for WhatsApp Web per day. Once it's hit, WhatsApp stays locked until midnight, regardless of cooldowns.
- **Usage stats** – The popup shows how much time you've used today and how many times you've opened WhatsApp, so you can see the pattern, not just feel it.
- **Full-screen lock overlay** – When locked, a countdown covers the page and the tab title hides unread counts so you're not tempted by notifications.
- **Accurate time tracking** – Time only counts while WhatsApp Web is the active, visible tab, not while you're on another app or tab.

## How it works

1. Open the extension popup and set your session length, cooldown duration, and daily limit.
2. Use WhatsApp Web as normal. A small timer in the corner shows your remaining time.
3. When your session or daily limit runs out, WhatsApp Web locks with a countdown until it reopens.
4. Settings are locked while WhatsApp is locked, so you can't loosen the limits in the moment.

## Installation

1. Clone or download this repository.
2. Go to `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the project folder.
5. Pin the extension and open `web.whatsapp.com` to see it in action.

## Tech

Built with dil:), a content script for WhatsApp Web, and `chrome.storage.local` for settings and state. No external dependencies, no data leaves your browser.
