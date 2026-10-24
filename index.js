const {
  Events, ActivityType, EmbedBuilder, MessageFlags, ApplicationFlags,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const client = require('./lib/client');
const hook = require('./lib/hook');
const { config, theme, parseColor, formatUptime, getToken, escapeMd } = require('./lib/util');
const logger = require('./lib/logger');
const commandList = require('./commands');
const whitelist = require('./lib/whitelist');
const tickets = require('./lib/tickets');
require('./lib/welcome');
require('./lib/dm');

const RES = GetCurrentResourceName();
const startedAt = Date.now();
const commands = new Map(commandList.map((c) => [c.data.name, c]));

const token = getToken();

let statusMsg = null;
let statusTimer = null;
let presenceTimer = null;
let presenceIdx = 0;

const log = (...a) => console.log(`^5[${RES}]^7`, ...a);

if (!token) logger.error('No bot token', 'Put it in config.json -> "token".');
if (config.guildId && !/^\d{15,25}$/.test(String(config.guildId))) logger.warn('config.json -> guildId does not look like a server ID (copy the SERVER ID, in quotes).');

function playerCounts() {
  return { players: GetNumPlayerIndices(), max: GetConvarInt('sv_maxclients', 48) };
}

function playerNames(limit = 25) {
  const names = [];
  for (let i = 0; i < GetNumPlayerIndices() && names.length < limit; i++) {
    const id = GetPlayerFromIndex(i);
    names.push(GetPlayerName(id));
  }
  return names.filter(Boolean).map(escapeMd);
}

function joinRow(s) {
  const c = String(s.connect || '').trim();
  if (!c) return [];
  let url = null;
  if (/^https?:\/\//i.test(c)) url = c;
  else if (/^cfx\.re\/join\//i.test(c)) url = `https://${c}`;
  if (!url) return [];
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(String(s.buttonLabel || 'Join server')).setEmoji('🎮').setURL(url),
  )];
}

let peak = 0;
let peakDay = new Date().toDateString();

const bar = (n, max, len = 12) => {
  const filled = max ? Math.round(Math.min(n / max, 1) * len) : 0;
  return '▰'.repeat(filled) + '▱'.repeat(len - filled);
};

function buildStatusEmbed(offline) {
  const s = config.status || {};
  const { players, max } = playerCounts();
  if (peakDay !== new Date().toDateString()) { peakDay = new Date().toDateString(); peak = 0; }
  if (players > peak) peak = players;

  const name = s.serverName || GetConvar('sv_projectName', '') || 'FiveM Server';
  const every = Math.max(15, s.updateSeconds || 60);
  const embed = new EmbedBuilder()
    .setColor(offline ? theme('muted') : parseColor(s.color, theme('primary')))
    .setAuthor({ name: String(name).replace(/\^\d/g, '').slice(0, 100) })
    .setTitle(offline ? '🔴  Server Offline' : '🟢  Server Online')
    .setFooter({ text: offline ? 'Live · offline' : `Live · updates every ${every}s` })
    .setTimestamp();

  if (s.logoUrl && /^https?:\/\//i.test(s.logoUrl)) embed.setThumbnail(s.logoUrl);
  if (s.imageUrl && /^https?:\/\//i.test(s.imageUrl)) embed.setImage(s.imageUrl);

  if (offline) {
    embed.setDescription('The server is currently offline.\nWe will be back soon.');
    return embed;
  }

  const pct = max ? Math.round((players / max) * 100) : 0;
  embed.setDescription(`${bar(players, max)}  **${players}/${max}**  ·  ${pct}% full`);
  embed.addFields(
    { name: '👥 Players', value: `${players}/${max}`, inline: true },
    { name: '📈 Peak today', value: String(peak), inline: true },
    { name: '⏱️ Uptime', value: formatUptime(Date.now() - startedAt), inline: true },
  );
  if (s.connect) embed.addFields({ name: '🎮 Connect', value: `\`${String(s.connect).replace(/`/g, '')}\`` });
  if (s.showPlayerList) {
    const names = playerNames(25);
    if (names.length) embed.addFields({ name: 'Online now', value: names.join(', ').slice(0, 1024) });
  }
  return embed;
}

const isStatusMessage = (m, botId) => {
  const t = m.embeds[0]?.footer?.text || '';
  return m.author.id === botId && (t.startsWith('Live ·') || t === 'p_fxserverbot_status');
};

async function updateStatus(offline = false) {
  const s = config.status;
  if (!s || !s.enabled || !s.channelId || !client.isReady()) return;

  const channel = await client.channels.fetch(s.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = buildStatusEmbed(offline);
  const components = offline ? [] : joinRow(s);

  if (!statusMsg) {
    const recent = await channel.messages.fetch({ limit: 20 }).catch(() => null);
    if (recent) statusMsg = recent.find((m) => isStatusMessage(m, client.user.id)) || null;
  }

  if (statusMsg) {
    await statusMsg.edit({ embeds: [embed], components }).catch(() => { statusMsg = null; });
  }
  if (!statusMsg) {
    statusMsg = await channel.send({ embeds: [embed], components }).catch((e) => { logger.warn(`Could not post the status embed: ${e.message}`); return null; });
  }
}

function updatePresence() {
  const p = config.presence;
  if (!p || !p.enabled || !client.isReady()) return;
  const { players, max } = playerCounts();

  const list = Array.isArray(p.texts) && p.texts.length ? p.texts : [p.text || '{players}/{max} players'];
  const raw = list[presenceIdx % list.length];
  presenceIdx++;

  const text = String(raw)
    .replace('{players}', players)
    .replace('{max}', max)
    .replace('{uptime}', formatUptime(Date.now() - startedAt))
    .slice(0, 128);
  const type = ActivityType[p.type] ?? ActivityType.Custom;
  const activity = type === ActivityType.Custom
    ? { name: 'Custom Status', type, state: text }
    : { name: text, type };

  client.user.setPresence({
    status: ['online', 'idle', 'dnd', 'invisible'].includes(p.status) ? p.status : 'online',
    activities: [activity],
  });
}

async function updateBio() {
  const b = config.bio;
  if (!b || !b.enabled) return;
  try {
    const app = await client.application.fetch();
    const edit = {};

    if (b.description && app.description !== b.description) edit.description = String(b.description).slice(0, 400);

    if (Object.keys(edit).length) {
      await app.edit(edit);
      log('Bot profile updated');
    }
  } catch (err) {
    log('Could not update bot profile (set it in the Developer Portal instead):', err.message);
  }
}

client.once(Events.ClientReady, async () => {
  log(`Logged in as ${client.user.tag}`);

  const defs = commandList.map((c) => c.data.toJSON());
  try {
    if (config.guildId) {
      const guild = await client.guilds.fetch(config.guildId);
      await guild.commands.set(defs);
    } else {
      await client.application.commands.set(defs);
    }
    log(`Registered ${defs.length} slash commands`);
  } catch (err) {
    logger.error('Failed to register commands', err.message);
  }

  if (config.guildId) {
    const others = client.guilds.cache.filter((g) => g.id !== String(config.guildId));
    if (others.size) logger.warn(`The bot is also in ${others.size} other server(s): ${others.map((g) => g.name).join(', ')}. Turn "Public Bot" off in the Developer Portal.`);
  }
  logger.lifecycle('🟢 Bot started', `${client.user.tag} · ${defs.length} commands`);

  await updateBio();

  updatePresence();
  updateStatus();
  presenceTimer = setInterval(updatePresence, Math.max(10, (config.presence?.updateSeconds || 30)) * 1000);
  statusTimer = setInterval(updateStatus, Math.max(15, (config.status?.updateSeconds || 60)) * 1000);
  tickets.startTimers();
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (config.guildId && interaction.guildId && interaction.guildId !== String(config.guildId)) return;

  if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
    if (tickets.owns(interaction)) await tickets.handle(interaction);
    else await whitelist.handle(interaction);
    return;
  }

  const cmd = commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    if (interaction.isAutocomplete()) {
      if (cmd.autocomplete) await cmd.autocomplete(interaction);
    } else if (interaction.isChatInputCommand()) {
      logger.audit(`${interaction.user.username} (${interaction.user.id}) used ${interaction.toString().slice(0, 300)}`);
      await cmd.execute(interaction);
    }
  } catch (err) {
    logger.error(`Command error (/${interaction.commandName})`, err.stack || String(err));
    if (interaction.isChatInputCommand()) {
      const msg = { content: 'Something went wrong.', flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) interaction.editReply(msg).catch(() => {});
      else interaction.reply(msg).catch(() => {});
    }
  }
});

client.on(Events.Error, (e) => logger.error('Discord error', e.message));
client.on(Events.Warn, (m) => logger.warn(`Discord warning: ${m}`));
client.on(Events.ShardDisconnect, () => logger.warn('Lost connection to Discord, reconnecting...'));
client.on(Events.ShardReconnecting, () => logger.warn('Reconnecting to Discord...'));
process.on('unhandledRejection', (err) => logger.error('Unhandled promise rejection', err && err.stack ? err.stack : String(err)));

exports('sendMessage', (channel, name, content, avatar) =>
  hook.send(channel, { name, content, avatar }).catch((e) => { log('sendMessage failed:', e.message); return false; }));

exports('sendEmbed', (channel, name, embed, avatar) =>
  hook.send(channel, { name, avatar, embeds: [embed] }).catch((e) => { log('sendEmbed failed:', e.message); return false; }));

exports('dmUser', async (discordId, content) => {
  try {
    const user = await client.users.fetch(String(discordId));
    await user.send({ embeds: [new EmbedBuilder().setColor(theme('primary')).setDescription(String(content).slice(0, 4000))] });
    return true;
  } catch (e) {
    log('dmUser failed:', e.message);
    return false;
  }
});

if (token) {
  client.login(token).catch((err) => logger.error('Login failed (wrong token, or intents not enabled in the Developer Portal)', err.message));
}

on('onResourceStop', async (res) => {
  if (res !== RES) return;
  clearInterval(statusTimer);
  clearInterval(presenceTimer);
  tickets.stopTimers();
  try { await updateStatus(true); } catch (_) {}
  try { await logger.lifecycle('🔴 Bot stopped', 'Resource stopped.'); await new Promise((r) => setTimeout(r, 800)); } catch (_) {}
  client.destroy();
});
