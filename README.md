<div align="center">

# 🤖 p_fxserverbot

**An all-in-one Discord bot that runs inside your FiveM server.**
Live status, tickets, whitelist applications, logs, welcome messages and more.

![Version](https://img.shields.io/badge/version-1.0.0-00d4ff?style=for-the-badge)
![FiveM](https://img.shields.io/badge/FiveM-resource-f40552?style=for-the-badge)
![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge)

Made by **Pena**

</div>

---

## ✨ Features

- 🟢 **Live status embed** with player bar, uptime, peak players and a *Join server* button
- 🎫 **Ticket system** with claim/close, transcripts, 1-5 star ratings and auto-close
- 📋 **Whitelist applications** with Accept/Deny buttons for staff
- 👋 **Welcome / goodbye messages** and automatic roles
- 🎮 **Discord Rich Presence** showing what each player is doing in-game
- 📝 **Logs** for joins/leaves, in-game chat, errors and command usage
- 💬 **DM auto-reply** with an optional staff forward channel
- 🛠️ **Slash commands** such as `/players`, `/kick`, `/announce`, `/poll` and `/say`
- 🔌 **Lua exports** so your other resources can send messages, embeds and DMs
- ♻️ **`/reloadconfig`** to change texts, colors and roles without a restart

## 🚀 Quick start

1. Download or clone this repo into your server's `resources` folder.
2. Create a bot in the [Discord Developer Portal](https://discord.com/developers/applications) and copy the token.
3. Add the token and your IDs to `config.json` (or use the convar below).
4. Add this to your `server.cfg`:
   ```cfg
   ensure yarn
   ensure p_fxserverbot
   ```
5. Restart the server. The bot comes online with the resource.

---

## Setup
1. Needs the `yarn` resource (comes with cfx-server-data) started BEFORE p_fxserverbot.
2. Discord Developer Portal -> create app -> Bot -> -> Reset token -> Copy token, then ->
   Invite with scopes `bot` + `applications.commands`, permissions: Manage Webhooks, Manage Channels, Manage Roles, Manage Messages, Send Messages, Embed Links, Attach Files, Add Reactions, Kick Members, View Channel, Read Message History.
3. Put the token in `config.json` -> `"token"`. Nothing needed in server.cfg except:
   ```
   ensure yarn
   ensure p_fxserverbot
   ```
   (Way of server.cfg still works as a fallback: `set p_fxserverbot_token "..."` in server.cfg, used only if `token` in config.json is empty or the placeholder.)
4. Fill the rest of config.json (see below). Minimum: `token`, `guildId`, `channels.logs`, `status.channelId`.
5. **Never share config.json with the token inside** If a token leaks, press "Reset Token" in the Developer Portal. Check SECURITY.md if you have security concerns.

## Status embed
`status` in config.json. One message in `status.channelId` that edits itself: 🟢/🔴 title, player bar `▰▰▰▱▱▱ 12/48 · 25% full`, peak today, uptime, connect address and a **Join server** button. Keys: `serverName`, `logoUrl` (small image), `imageUrl` (banner), `connect` (`cfx.re/join/abc123`), `showPlayerList`, `updateSeconds`. When the resource stops it switches to 🔴 Offline.

## Discord Rich Presence (in-game)
Shows what each player is doing on **their own Discord profile**, e.g. `Pena | Vinewood Blvd | 12/48`. Runs on the player's client (`client.lua`); the server only sends a filtered copy of `richPresence`. Players need the Discord desktop app open and privacy settings configured.

Setup: Developer Portal -> your application -> copy the **Application ID** into `richPresence.appId`. Upload images under *Rich Presence -> Art Assets* and put the asset names in `largeImage` / `smallImage` (e.g. `logo`). Restart the resource, or use `/reloadconfig` to push changes to everyone online.

| Key | What it does |
|---|---|
| `enabled`, `appId` | On/off and the Discord Application ID (empty = off) |
| `texts` | Lines that rotate every `rotateSeconds` (max 128 chars each). Placeholders: `{name}` `{id}` `{street}` `{crossing}` `{zone}` `{direction}` `{vehicle}` `{speed}` `{activity}` `{players}` `{max}` `{server}` |
| `updateSeconds` | How often it refreshes (min 2) |
| `largeImage`, `largeText`, `smallImage`, `smallText` | Images and their hover text (hover text supports the same placeholders) |
| `serverName` | Used for `{server}`. Empty = `sv_projectName` / `sv_hostname` |
| `speedUnit` | `kmh` or `mph` for `{speed}` |
| `buttons` | Up to 2: `{ "label": "Join server", "url": "https://..." }` (`https://`, `fivem://connect/...` or `cfx.re/join/...`). Empty URLs are skipped |
| `activities` | Optional text overrides: `pause`, `dead`, `driving`, `passenger`, `motorcycle`, `bicycle`, `boat`, `heli`, `plane`, `swimming`, `skydiving`, `sprinting`, `running`, `walking`, `idle` |

Add your own placeholder from another resource (client side), e.g. a job: `exports.p_fxserverbot:setPresenceVar('job', 'Police')`, then use `{job}` in `texts`.

## Logs
- **Console**: every error/warning is printed, the token is always removed from the text.
- **Discord** (`logging` in config.json, channel must be private): `errors` (command/ticket/whitelist errors, lost connection, unhandled errors), `startStop` (bot started/stopped), `commandAudit` (who used which slash command). Max 10 posts/minute, duplicates are merged.
- **Server events** (server.lua): `logJoinLeave`, `logChat`, `logServerStart`. Tickets log to `tickets.logChannel`, kicks to `logs`.
- **Webhooks**: one webhook per channel (created by the bot), nothing sent through it can ping @everyone/roles/users. Player names are sanitised so a player called "Discord" can't hide from the logs.

## Auto-reply when someone DMs the bot
`config.json -> dmReply`. Replies to every private message the bot receives.

| Key | What it does |
|---|---|
| `enabled` | on/off (needs a resource restart to change) |
| `useEmbed` | `true` = embed, `false` = plain text message |
| `title`, `message`, `footer`, `color`, `imageUrl`, `thumbnailUrl` | The text/look. Placeholders: `{user}`, `{username}`, `{tag}`, `{id}`, `{server}`. `\n` = new line |
| `cooldownSeconds` | `0` = reply to EVERY message. e.g. `60` = at most once a minute per person |
| `typingDelayMs` | Shows "typing..." for this long before replying (0 = instant) |
| `forward` | `{ "enabled": true, "channel": "dmLogs" }` copies every DM to a staff channel so you can read them. Off by default (privacy: tell your members if you turn it on) |

Preview it with `/dmtest`. Change the text, then `/reloadconfig`.

## Config
Turn on Developer Mode in Discord (Settings -> Advanced), then right-click -> Copy ID.

| Key | What to put |
|---|---|
| `token` | Bot token |
| `guildId` | Your server's ID (commands register instantly in that server only) |
| `adminRoleIds` | Role IDs allowed to use commands, **in quotes**. Empty `[]` = only server Administrators can use staff commands |
| `channels` | Name -> channel ID. `logs` = join/leave, `chatLogs` = in-game chat, `dmLogs` = forwarded DMs, `ticketLogs`, `whitelistReview`, `welcome` |
| `presets` | Name -> avatar image URL (https). Shows in the /say name dropdown |
| `status` | Live Online/Offline embed: `channelId`, `connect` (`cfx.re/join/abc123` also makes a **Join server** button), `showPlayerList`, `imageUrl`, `updateSeconds` |
| `presence` | Bot status. `type`: `Custom` (the text bubble next to the avatar, like a user's custom status), `Playing`, `Watching`, `Listening`, `Competing`. `texts` = list that rotates every `updateSeconds` (`{players}`, `{max}`, `{uptime}`; max 128 chars; emojis can be typed straight into the text), `status` = online / idle / dnd / invisible |
| `bio` | Bot profile description, applied on start |
| `logJoinLeave` | Join/leave embeds in `logs` |
| `logChat` | In-game chat to `chatLogs` |
| `logServerStart` | "Server started" embed in `logs` |

## Welcome / goodbye / auto role
`welcome` in config.json. **Needs the Server Members Intent** (Developer Portal -> Bot -> Privileged Gateway Intents), or set `enabled` to `false` and leave goodbye/autoRoleIds empty.

| Key | What it does |
|---|---|
| `channel`, `title`, `message`, `footer`, `color`, `showAvatar`, `imageUrl`, `pingUser` | The welcome embed. Placeholders: `{user}`, `{username}`, `{tag}`, `{id}`, `{server}`, `{memberCount}` |
| `dm` | `{ "enabled": true, "message": "..." }` also DMs the new member |
| `autoRoleIds` | Roles given automatically on join (quoted IDs; bot role must be above them) |
| `goodbye` | `{ "enabled": true, "channel": "welcome", "message": "...", "color": "#0b3a5b" }` message when someone leaves |

Preview with `/welcometest`.

## Whitelist applications
`whitelist` in config.json. Run `/whitelistpanel` where people should apply. Applications land in `channels.whitelistReview` with **Accept / Deny** buttons; applicant gets DMs.

Extras: `minAccountAgeDays` flags brand-new Discord accounts on the application, `createThread` opens a staff discussion thread under every application, `/whitelist add|remove` gives/removes the role by hand, and a Lua event `p_fxserverbot:whitelistAccepted(discordId, username, answers)` / `p_fxserverbot:whitelistRemoved` fires so you can whitelist the player in your own system (see server.lua).

Other keys: `reviewerRoleIds`, `pingRoleId`, `whitelistRoleId` (bot needs Manage Roles, role above it), `cooldownMinutes`, `dmApplicant`, `acceptMessage`, `denyMessage`, `colors`, `panel`, `modalTitle`, `questions` (max 5).

## Support tickets
`tickets` in config.json. Run `/ticketpanel`. Members pick a reason, fill a form, a private channel is created.

- Buttons in the ticket: **Claim** (staff, shows "Claimed by", DMs the opener), **Close** (optional reason), then **Reopen / Archive / Delete**.
- **Transcript**: on close a `.txt` of the conversation (up to 1000 messages) goes to the log channel and to the opener's DM. Settings: `transcript: { enabled, log, dmUser }`.
- **Rating**: the close DM has 1-5 star buttons, the result is posted to the log channel. `rating: false` turns it off.
- **Auto-close**: `autoCloseHours: 24` closes open tickets with no messages for 24 h (0 = off).
- **Per-reason options** inside `reasons`: `categoryId`, `pingRoleId`, `color`, `intro`, `placeholder`, `emoji`.
- `/ticket add | remove | rename | transcript` inside a ticket (staff).
- Other keys: `categoryId`, `archiveCategoryId`, `staffRoleIds`, `pingRoleId`, `logChannel`, `maxOpenPerUser`, `dmUser`, `dmOnClaim`, `welcomeMessage`, `openDm`, `closeDm`, `colors`, `panel`.

Bot needs **Manage Channels**, **Manage Roles**, **Manage Messages**. Ticket state lives in the channel topic + permissions, so it survives restarts. Don't edit the topic.

## Commands
| Command | |
|---|---|
| `/ticketpanel` | post the support ticket panel |
| `/ticket add/remove/rename/transcript` | manage the current ticket |
| `/whitelistpanel` | post the whitelist panel |
| `/whitelist add/remove` | give/remove whitelist by hand |
| `/welcometest` | preview the welcome message |
| `/dmtest` | preview the DM auto-reply |
| `/say` | send as any name/avatar (presets autocomplete), plain or embed |
| `/players` | who is online (ID, ping, Discord mention) |
| `/serverinfo` | players, uptime, resources, bot ping |
| `/announce` | in-game announcement (edit in server.lua) |
| `/kick` | kick a player by server ID |
| `/poll` | reaction poll (yes/no or up to 4 options) |
| `/clear` | delete the latest 1-100 messages |
| `/setbot` | change the bot's name/avatar |
| `/reloadconfig` | reload config.json live (texts, colors, questions, roles) |
| `/help` | list commands |

`/reloadconfig` does not change the token, Discord intents, timers, or the command list: restart the resource for those.

## From Lua
```lua
exports.p_fxserverbot:sendMessage('logs', 'Any Name', 'text', 'optional avatar url')
exports.p_fxserverbot:sendEmbed('logs', 'Any Name', { title = 'x', description = 'y', color = '#00d4ff' })
exports.p_fxserverbot:dmUser('123456789012345678', 'Your application was approved!')
```

## Security notes
- Make the channels `whitelistReview`, `ticketLogs`, `dmLogs`, `botLogs` **private**.
- Turn **Public Bot** off. The bot ignores interactions from any server except `guildId` and warns in the console if it is in another one.
- If `adminRoleIds` is empty, only members with the Administrator permission can use the staff commands. Fill `adminRoleIds` with your staff roles.
- The Lua events `p_fxserverbot:announce`, `whitelistAccepted`, `whitelistRemoved` must stay `AddEventHandler` (never `RegisterNetEvent`).

## Troubleshooting
- **`Failed to register commands: Unknown Guild`**: the bot isn't in that server yet, `guildId` is wrong (copy the SERVER ID, quoted string), or the token belongs to another app.
- **`No bot token`**: fill `token` in config.json.
- **`Used disallowed intents`**: turn on Server Members Intent in the Developer Portal, or disable welcome/goodbye/autoRoleIds.
- **Bot doesn't answer DMs**: `dmReply.enabled` must be `true` and the resource restarted. People with DMs closed to server members can still message the bot only if they share a server with it.
- **Commands say "No permission"**: role IDs in `adminRoleIds` must be quoted strings.
- **/say fails**: bot needs Manage Webhooks in that channel. Names can't contain "discord" or "clyde".
- **Commands don't show up**: `guildId` must be filled; restart the resource after changing it.
- **Resource won't start / discord.js missing**: `ensure yarn` must run before `ensure p_fxserverbot`.
- **Making the bot private**: Developer Portal -> Installation -> Install Link: None, Bot tab -> Public Bot off, then invite with the OAuth2 URL Generator.

## Setup note
Edit `config.json` to your liking and paste your bot token into `"token"`. Alternatively leave `token` empty and use `set p_fxserverbot_token "..."` in server.cfg. Both work, config.json is checked first.

## Trust model
Any server-side resource on your FXServer can read this resource's `config.json`/convars and call its exports (`sendMessage`, `sendEmbed`, `dmUser`). Only run resources you trust, never give the bot Administrator, and reset the token if you ever run something untrusted.

- `/players` hides Discord accounts by default. Set `players.showDiscord` to `true` to show them to staff only.
- `tickets.transcript.dmUser` is `false` by default: the transcript includes staff messages.
