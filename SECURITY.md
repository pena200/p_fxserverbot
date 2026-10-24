# Security
- The bot token can live in `config.json` (`"token"`) or in server.cfg (`set p_fxserverbot_token`). `config.json` is **not** in `fxmanifest.lua` `files`, so players can't access it. Never add it there.
- Keep the review / ticket log / bot log / DM log channels **private** (staff only): they contain applications, transcripts and DMs.
- Turn **Public Bot** off in the Developer Portal so nobody can add the bot to other servers.
- Found a vulnerability? Open a private security advisory on GitHub instead of a public issue for safety reasons.
