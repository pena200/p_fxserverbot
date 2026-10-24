const client = require('./client');
const { config, parseColor, channelId } = require('./util');
const logger = require('./logger');

const cache = new Map();

function getHook(channel) {
  const target = channel.isThread() ? channel.parent : channel;
  if (!target || typeof target.fetchWebhooks !== 'function') throw new Error('This channel type does not support webhooks');
  if (!cache.has(target.id)) {
    const p = (async () => {
      const hooks = await target.fetchWebhooks();
      let hook = hooks.find((h) => h.owner && h.owner.id === client.user.id);
      if (!hook) hook = await target.createWebhook({ name: 'p_fxserverbot' });
      return hook;
    })();
    cache.set(target.id, p);
    p.catch(() => cache.delete(target.id));
  }
  return cache.get(target.id);
}

function cleanName(name) {
  const s = String(name == null ? '' : name)
    .replace(/[\r\n]+/g, ' ')
    .replace(/(discord|clyde)/gi, (m) => `${m.slice(0, 2)}·${m.slice(2)}`)
    .trim()
    .slice(0, 80);
  return s || 'Server';
}

function cleanEmbed(e) {
  if (!e || typeof e !== 'object') return null;
  const out = { ...e, color: parseColor(e.color) };
  if (out.title) out.title = String(out.title).slice(0, 256);
  if (out.description) out.description = String(out.description).slice(0, 4096);
  if (Array.isArray(out.fields)) out.fields = out.fields.slice(0, 25);
  return out;
}

async function send(channelRef, { name, avatar, content, embeds } = {}) {
  if (!client.isReady()) return false;

  const channel = await client.channels.fetch(channelId(channelRef)).catch(() => null);
  if (!channel || !channel.isTextBased() || channel.isDMBased()) return false;

  if (config.guildId && channel.guildId && channel.guildId !== String(config.guildId)) return false;

  if (!avatar && config.presets && config.presets[name]) avatar = config.presets[name];

  if (avatar && !/^https?:\/\//i.test(String(avatar).trim())) avatar = undefined;

  const payload = {
    username: cleanName(name),
    avatarURL: avatar || undefined,
    content: content ? String(content).slice(0, 2000) : undefined,
    embeds: (Array.isArray(embeds) ? embeds : []).slice(0, 10).map(cleanEmbed).filter(Boolean),
    allowedMentions: { parse: [] },
  };
  if (!payload.content && !payload.embeds.length) return false;
  if (channel.isThread()) payload.threadId = channel.id;

  const parentId = channel.isThread() ? channel.parent && channel.parent.id : channel.id;
  try {
    await (await getHook(channel)).send(payload);
  } catch (err) {
    if (err && (err.code === 10015 || err.status === 404)) {

      cache.delete(parentId);
      await (await getHook(channel)).send(payload);
    } else {
      logger.warn(`Webhook send failed in ${channelRef}: ${err.message}`);
      throw err;
    }
  }
  return true;
}

module.exports = { send };
