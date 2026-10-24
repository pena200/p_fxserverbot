function loadConfig() {
  const res = GetCurrentResourceName();
  const raw = LoadResourceFile(res, 'config.json');
  if (!raw) console.log('^1[p_fxserverbot] config.json not found in the resource folder.^7');
  try {
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.log(`^1[p_fxserverbot] config.json is not valid JSON: ${err.message}^7`);
    return {};
  }
}
const config = loadConfig();

function getToken() {
  const t = String(config.token || '').trim();
  if (t && !/^(YOUR_|PASTE_)/i.test(t)) return t;
  return String(GetConvar('p_fxserverbot_token', '')).trim();
}

function escapeMd(text) {
  return String(text == null ? '' : text).replace(/[\\*_~`|>[\]()#-]/g, '\\$&').replace(/@/g, '@\u200b');
}

const DEFAULT_THEME = {
  primary: '#00d4ff',
  secondary: '#0077ff',
  accent: '#7df9ff',
  success: '#00e5c3',
  pending: '#38bdf8',
  danger: '#5b7cfa',
  muted: '#0b3a5b',
};

function hex(c) {
  if (typeof c === 'number') return c;
  if (typeof c === 'string') {
    const n = parseInt(c.replace('#', ''), 16);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function theme(key) {
  const v = hex((config.theme || {})[key]);
  if (v !== null) return v;
  return hex(DEFAULT_THEME[key]) ?? hex(DEFAULT_THEME.primary);
}

function parseColor(c, fallback) {
  const v = hex(c);
  if (v !== null) return v;
  return fallback !== undefined ? fallback : theme('primary');
}

function isAllowed(interaction) {
  if (interaction.memberPermissions && interaction.memberPermissions.has('Administrator')) return true;
  const roles = (config.adminRoleIds || []).map(String).filter(Boolean);
  if (!roles.length) return false;
  if (!interaction.member || !interaction.member.roles) return false;
  return interaction.member.roles.cache.some((r) => roles.includes(r.id));
}

function channelId(ref) {
  return String((config.channels && config.channels[ref]) || ref || '');
}

function fill(text, vars = {}) {
  return String(text || '')
    .replace(/\\n/g, '\n')
    .replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : m));
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [d ? `${d}d` : '', h || d ? `${h}h` : '', `${m}m`].filter(Boolean).join(' ');
}

function reloadConfig() {
  const raw = LoadResourceFile(GetCurrentResourceName(), 'config.json');
  const fresh = JSON.parse(raw);
  for (const k of Object.keys(config)) delete config[k];
  Object.assign(config, fresh);
  return config;
}

for (const id of config.adminRoleIds || []) {
  if (typeof id === 'number') console.log('^3[p_fxserverbot] adminRoleIds must be quoted strings, e.g. ["123456789012345678"]. Number IDs are rounded and will not match.^7');
}

module.exports = { isAllowed, parseColor, theme, channelId, fill, formatUptime, reloadConfig, getToken, escapeMd, config };
