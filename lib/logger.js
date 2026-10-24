const { EmbedBuilder } = require('discord.js');
const client = require('./client');
const { config, theme, channelId, getToken } = require('./util');

const RES = GetCurrentResourceName();
const cfg = () => config.logging || {};

function redact(text) {
  let s = String(text);
  const t = getToken();
  if (t) s = s.split(t).join('[token]');
  return s.replace(/[\w-]{23,28}\.[\w-]{6,7}\.[\w-]{27,}/g, '[token]');
}

const sentAt = [];
const recent = new Map();

async function toDiscord(color, title, text) {
  const c = cfg();
  if (!c.channel || !client.isReady()) return;

  const now = Date.now();
  while (sentAt.length && now - sentAt[0] > 60000) sentAt.shift();
  if (sentAt.length >= 10) return;
  const key = `${title}|${text}`;
  if ((recent.get(key) || 0) > now - 30000) return;
  if (recent.size > 100) recent.clear();
  recent.set(key, now);
  sentAt.push(now);

  const ch = await client.channels.fetch(channelId(c.channel)).catch(() => null);
  if (!ch || !ch.isTextBased()) return;
  const body = redact(text).replace(/`/g, "'").slice(0, 3800);
  await ch.send({
    embeds: [new EmbedBuilder().setColor(color).setTitle(String(title).slice(0, 256)).setDescription(body ? `\`\`\`\n${body}\n\`\`\`` : null).setTimestamp()],
    allowedMentions: { parse: [] },
  }).catch(() => {});
}

const info = (...a) => console.log(`^5[${RES}]^7`, redact(a.join(' ')));
const warn = (...a) => console.log(`^3[${RES}] ${redact(a.join(' '))}^7`);

function error(title, detail = '') {
  console.log(`^1[${RES}] ${redact(title)}${detail ? `: ${redact(detail)}` : ''}^7`);
  if (cfg().errors !== false) toDiscord(theme('danger'), `⚠️ ${title}`, String(detail || ''));
}

function lifecycle(title, text = '') {
  if (cfg().startStop !== false) toDiscord(theme('primary'), title, text);
}

function audit(text) {
  if (cfg().commandAudit) toDiscord(theme('secondary'), '🧾 Command used', text);
}

module.exports = { info, warn, error, lifecycle, audit, redact };
