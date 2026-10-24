const { Events, EmbedBuilder } = require('discord.js');
const client = require('./client');
const { config, theme, parseColor, channelId, fill } = require('./util');

const cfg = () => config.welcome || {};
const log = (...a) => console.log('^5[p_fxserverbot]^7', ...a);

function vars(member) {
  return {
    user: `<@${member.id}>`,
    username: member.user.username,
    tag: member.user.tag,
    id: member.id,
    server: member.guild.name,
    memberCount: member.guild.memberCount,
  };
}

function buildEmbed(member) {
  const w = cfg();
  const v = vars(member);
  const embed = new EmbedBuilder()
    .setColor(parseColor(w.color, theme('primary')))
    .setDescription(fill(w.message || 'Welcome {user}!', v).slice(0, 4000))
    .setTimestamp();

  if (w.title) embed.setTitle(fill(w.title, v).slice(0, 256));
  if (w.showAvatar !== false) embed.setThumbnail(member.displayAvatarURL({ size: 256 }));
  if (w.imageUrl && /^https?:\/\//i.test(w.imageUrl)) embed.setImage(w.imageUrl);
  if (w.footer) embed.setFooter({ text: fill(w.footer, v).slice(0, 2048) });
  return embed;
}

async function greet(member) {
  const w = cfg();

  if (w.enabled) {
    const channel = await client.channels.fetch(channelId(w.channel)).catch(() => null);
    if (channel && channel.isTextBased()) {
      await channel.send({
        content: w.pingUser === false ? undefined : `<@${member.id}>`,
        embeds: [buildEmbed(member)],
        allowedMentions: { users: [member.id] },
      }).catch((e) => log(`^1Welcome message failed: ${e.message}^7`));
    } else {
      log('^3welcome.channel is not set or the bot cannot see it.^7');
    }

    if (w.dm && w.dm.enabled && w.dm.message) {
      const dm = new EmbedBuilder()
        .setColor(parseColor(w.color, theme('primary')))
        .setDescription(fill(w.dm.message, vars(member)).slice(0, 4000));
      await member.send({ embeds: [dm] }).catch(() => {});
    }
  }

  for (const roleId of (w.autoRoleIds || []).map(String).filter(Boolean)) {
    await member.roles.add(roleId, 'Auto role on join').catch((e) => log(`^3Could not give auto role ${roleId}: ${e.message}^7`));
  }
}

async function farewell(member) {
  const g = cfg().goodbye || {};
  if (!g.enabled) return;
  const channel = await client.channels.fetch(channelId(g.channel || cfg().channel)).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  const v = vars(member);
  const embed = new EmbedBuilder()
    .setColor(parseColor(g.color, theme('muted')))
    .setDescription(fill(g.message || '**{username}** left the server.', v).slice(0, 4000))
    .setTimestamp();
  if (g.title) embed.setTitle(fill(g.title, v).slice(0, 256));
  if (g.showAvatar !== false) embed.setThumbnail(member.displayAvatarURL({ size: 128 }));
  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
}

client.on(Events.GuildMemberAdd, (member) => {
  if (member.user.bot) return;
  if (config.guildId && member.guild.id !== String(config.guildId)) return;
  greet(member).catch((e) => log(`^1Welcome error: ${e.message}^7`));
});

client.on(Events.GuildMemberRemove, (member) => {
  if (member.user && member.user.bot) return;
  if (config.guildId && member.guild.id !== String(config.guildId)) return;
  farewell(member).catch((e) => log(`^1Goodbye error: ${e.message}^7`));
});

module.exports = { buildEmbed };
