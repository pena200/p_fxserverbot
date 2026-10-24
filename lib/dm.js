const { Events, EmbedBuilder, ChannelType } = require('discord.js');
const client = require('./client');
const { config, theme, parseColor, channelId, fill } = require('./util');
const logger = require('./logger');

const cfg = () => config.dmReply || {};
const lastReply = new Map();
const hits = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withinLimit(userId) {
  const now = Date.now();
  const max = Math.max(1, Number(cfg().maxPerMinute) || 6);
  const arr = (hits.get(userId) || []).filter((t) => now - t < 60000);
  if (arr.length >= max) { hits.set(userId, arr); return false; }
  arr.push(now);
  hits.set(userId, arr);
  if (hits.size > 2000) {
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 60000) hits.delete(k);
    for (const [k, v] of lastReply) if (now - v > 3600000) lastReply.delete(k);
  }
  return true;
}

function vars(user) {
  const guild = client.guilds.cache.get(String(config.guildId || '')) || client.guilds.cache.first();
  return {
    user: `<@${user.id}>`,
    username: user.username,
    tag: user.tag,
    id: user.id,
    server: guild ? guild.name : 'the server',
  };
}

function buildReply(user) {
  const c = cfg();
  const v = vars(user);
  const text = fill(c.message || "Hi {username}, I'm a bot, so I can't have a conversation with you.", v).slice(0, 4000);
  if (c.useEmbed === false) return { content: text, allowedMentions: { parse: [] } };

  const embed = new EmbedBuilder()
    .setColor(parseColor(c.color, theme('primary')))
    .setDescription(text);
  if (c.title) embed.setTitle(fill(c.title, v).slice(0, 256));
  if (c.footer) embed.setFooter({ text: fill(c.footer, v).slice(0, 2048) });
  if (c.imageUrl && /^https?:\/\//i.test(c.imageUrl)) embed.setImage(c.imageUrl);
  if (c.thumbnailUrl && /^https?:\/\//i.test(c.thumbnailUrl)) embed.setThumbnail(c.thumbnailUrl);
  return { embeds: [embed], allowedMentions: { parse: [] } };
}

async function forward(message) {
  const f = cfg().forward || {};
  if (!f.enabled) return;
  const ch = await client.channels.fetch(channelId(f.channel)).catch(() => null);
  if (!ch || !ch.isTextBased()) return;
  const files = [...message.attachments.values()].map((a) => a.url);
  const embed = new EmbedBuilder()
    .setColor(theme('secondary'))
    .setAuthor({ name: `${message.author.username} (${message.author.id})`, iconURL: message.author.displayAvatarURL({ size: 64 }) })
    .setTitle('📨 DM to the bot')
    .setDescription((message.content || '*no text*').slice(0, 4000))
    .setTimestamp();
  if (files.length) embed.addFields({ name: 'Attachments', value: files.join('\n').slice(0, 1024) });
  await ch.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
}

client.on(Events.MessageCreate, async (message) => {
  const c = cfg();
  if (!c.enabled) return;
  if (message.author.bot || message.system) return;
  if (message.guild || (message.channel && message.channel.type !== ChannelType.DM)) return;
  if (!withinLimit(message.author.id)) return;

  const cooldown = (Number(c.cooldownSeconds) || 0) * 1000;
  const last = lastReply.get(message.author.id) || 0;
  forward(message).catch(() => {});
  if (cooldown && Date.now() - last < cooldown) return;
  lastReply.set(message.author.id, Date.now());

  try {
    if (Number(c.typingDelayMs) > 0) {
      await message.channel.sendTyping().catch(() => {});
      await sleep(Math.min(Number(c.typingDelayMs), 5000));
    }
    await message.channel.send(buildReply(message.author));
  } catch (err) {
    logger.warn(`DM auto-reply failed: ${err.message}`);
  }
});

module.exports = { buildReply };
