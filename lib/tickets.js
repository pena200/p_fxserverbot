const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits: P, MessageFlags,
  AttachmentBuilder, SnowflakeUtil,
} = require('discord.js');
const client = require('./client');
const { config, theme, parseColor, channelId, fill } = require('./util');
const logger = require('./logger');

const cfg = () => config.tickets || {};
const ephemeral = (content) => ({ content, flags: MessageFlags.Ephemeral });
const log = (...a) => console.log('^5[p_fxserverbot]^7', ...a);

const PREFIX = 'tk_';
const ID = {
  select: 'tk_select',
  open: 'tk_open',
  claim: 'tk_claim',
  close: 'tk_close',
  closeModal: 'tk_closemodal',
  reopen: 'tk_reopen',
  archive: 'tk_archive',
  del: 'tk_delete',
  rate: 'tk_rate',
};
const TOPIC_RE = /^p_fxserverbot_ticket:(\d+):(\d+)/;

const colorOf = (key, fallbackKey) => parseColor((cfg().colors || {})[key], theme(fallbackKey));
const reasons = () => (cfg().reasons || []).filter((r) => r && r.label).slice(0, 25);

function staffRoleIds() {
  const own = (cfg().staffRoleIds || []).map(String).filter(Boolean);
  if (own.length) return own;
  return (config.adminRoleIds || []).map(String).filter(Boolean);
}

function isStaff(i) {
  if (i.memberPermissions && i.memberPermissions.has(P.Administrator)) return true;
  const roles = staffRoleIds();
  if (!roles.length) return !!(i.memberPermissions && i.memberPermissions.has(P.ManageGuild));
  return !!(i.member && i.member.roles && i.member.roles.cache && i.member.roles.cache.some((r) => roles.includes(r.id)));
}

function ticketInfo(channel) {
  const m = channel && channel.topic ? TOPIC_RE.exec(channel.topic) : null;
  return m ? { ownerId: m[1], reasonIdx: Number(m[2]) } : null;
}

function stateOf(channel, ownerId) {
  const ow = channel.permissionOverwrites.cache.get(ownerId);
  if (!ow) return 'archived';
  if (ow.deny.has(P.ViewChannel)) return 'archived';
  if (ow.deny.has(P.SendMessages)) return 'closed';
  return 'open';
}

async function dm(userId, embed, extra = {}) {
  if (cfg().dmUser === false) return false;
  try {
    const user = await client.users.fetch(userId);
    await user.send({ embeds: [embed], ...extra });
    return true;
  } catch (_) {
    return false;
  }
}

async function logEvent(embed, files) {
  const ref = cfg().logChannel;
  if (!ref) return;
  const ch = await client.channels.fetch(channelId(ref)).catch(() => null);
  if (ch && ch.isTextBased()) ch.send({ embeds: [embed], files: files || [], allowedMentions: { parse: [] } }).catch(() => {});
}

function userOpenTickets(guild, userId) {
  return guild.channels.cache.filter((c) => {
    const t = ticketInfo(c);
    return t && t.ownerId === userId && stateOf(c, userId) !== 'archived';
  });
}

const cleanName = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'user';

async function buildTranscript(channel) {
  const all = [];
  let before;
  for (let n = 0; n < 10; n++) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || !batch.size) break;
    all.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  all.reverse();

  const lines = [
    `Transcript of #${channel.name}`,
    `Created: ${new Date().toISOString()}`,
    `Messages: ${all.length}`,
    '='.repeat(48),
  ];
  for (const m of all) {
    const t = new Date(m.createdTimestamp).toISOString().replace('T', ' ').slice(0, 19);
    let text = m.content || '';
    for (const e of m.embeds) {
      const parts = [e.title, e.description].filter(Boolean).map((x) => String(x).replace(/\n/g, ' '));
      if (parts.length) text += ` [embed: ${parts.join(' - ')}]`;
    }
    for (const a of m.attachments.values()) text += ` [file: ${a.url}]`;
    lines.push(`[${t}] ${m.author.tag}: ${text}`.trim());
  }
  const buffer = Buffer.from(lines.join('\n'), 'utf8');
  const name = `transcript-${channel.name}.txt`;
  return { name, count: all.length, file: () => new AttachmentBuilder(buffer, { name }) };
}

function panelMessage() {
  const p = cfg().panel || {};
  const list = reasons();
  const embed = new EmbedBuilder()
    .setTitle(fill(p.title || 'Support'))
    .setDescription(fill(p.description || 'Pick a reason below to open a support ticket.'))
    .setColor(parseColor(p.color, theme('primary')));
  if (p.imageUrl && /^https?:\/\//i.test(p.imageUrl)) embed.setImage(p.imageUrl);
  if (p.thumbnailUrl && /^https?:\/\//i.test(p.thumbnailUrl)) embed.setThumbnail(p.thumbnailUrl);
  if (p.footer) embed.setFooter({ text: fill(p.footer) });

  if (!list.length) return { embeds: [embed], components: [] };

  const menu = new StringSelectMenuBuilder()
    .setCustomId(ID.select)
    .setPlaceholder(String(p.placeholder || 'Choose a reason...').slice(0, 150))
    .addOptions(list.map((r, idx) => {
      const o = { label: String(r.label).slice(0, 100), value: String(idx) };
      if (r.description) o.description = String(r.description).slice(0, 100);
      if (r.emoji) o.emoji = r.emoji;
      return o;
    }));
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

async function onSelect(i) {
  const idx = Number(i.values[0]);
  const reason = reasons()[idx];
  if (!reason) return i.reply(ephemeral('That reason no longer exists.'));

  const max = Number(cfg().maxOpenPerUser) || 0;
  if (max && userOpenTickets(i.guild, i.user.id).size >= max) {
    const first = userOpenTickets(i.guild, i.user.id).first();
    return i.reply(ephemeral(`You already have an open ticket: <#${first.id}>. Close it before opening a new one.`));
  }

  const modal = new ModalBuilder()
    .setCustomId(`${ID.open}:${idx}`)
    .setTitle(String(reason.label).slice(0, 45))
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('details')
        .setLabel(String(cfg().detailsLabel || 'Describe your issue').slice(0, 45))
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(String(reason.placeholder || 'Give as much detail as you can...').slice(0, 100))
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(1000),
    ));
  await i.showModal(modal);
}

function controlRow(state, claimedBy) {
  if (state === 'open') {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(ID.claim).setLabel(claimedBy ? 'Unclaim' : 'Claim').setEmoji('🙋').setStyle(claimedBy ? ButtonStyle.Secondary : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(ID.close).setLabel('Close ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    );
  }
  if (state === 'closed') {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(ID.reopen).setLabel('Reopen').setEmoji('🔓').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(ID.archive).setLabel('Archive').setEmoji('🗄️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(ID.del).setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    );
  }

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(ID.del).setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
  );
}

function ratingRow(channelId_) {
  return new ActionRowBuilder().addComponents([1, 2, 3, 4, 5].map((n) =>
    new ButtonBuilder().setCustomId(`${ID.rate}:${n}:${channelId_}`).setLabel('⭐'.repeat(n)).setStyle(n >= 4 ? ButtonStyle.Primary : ButtonStyle.Secondary)));
}

const opening = new Set();

async function onOpen(i, idxStr) {
  if (!i.guild) return;
  if (opening.has(i.user.id)) return i.reply(ephemeral('Your ticket is already being created.'));
  opening.add(i.user.id);
  try { return await onOpenInner(i, idxStr); } finally { opening.delete(i.user.id); }
}

async function onOpenInner(i, idxStr) {
  const idx = Number(idxStr);
  const reason = reasons()[idx];
  if (!reason) return i.reply(ephemeral('That reason no longer exists.'));
  await i.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = i.guild;
  const max = Number(cfg().maxOpenPerUser) || 0;
  if (max && userOpenTickets(guild, i.user.id).size >= max) {
    return i.editReply('You already have an open ticket. Close it before opening a new one.');
  }

  const details = i.fields.getTextInputValue('details').trim();
  const staff = staffRoleIds();
  const allow = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks];

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
    { id: i.user.id, allow },
    { id: client.user.id, allow: [...allow, P.ManageChannels, P.ManageMessages] },
    ...staff.map((id) => ({ id, allow: [...allow, P.ManageMessages] })),
  ];

  const options = {
    name: `ticket-${cleanName(i.user.username)}-${String(Date.now()).slice(-4)}`,
    type: ChannelType.GuildText,
    topic: `p_fxserverbot_ticket:${i.user.id}:${idx} | ${reason.label} | ${i.user.username}`.slice(0, 1024),
    permissionOverwrites: overwrites,
    reason: `Ticket opened by ${i.user.tag}`,
  };
  const category = reason.categoryId || cfg().categoryId;
  if (category) options.parent = String(category);

  let channel;
  try {
    channel = await guild.channels.create(options);
  } catch (err) {
    log(`^1Could not create ticket channel: ${err.message}^7`);
    return i.editReply('Could not create your ticket channel. Please contact staff.');
  }

  const embed = new EmbedBuilder()
    .setTitle(`${reason.emoji ? reason.emoji + ' ' : ''}${reason.label}`)
    .setColor(parseColor(reason.color, colorOf('open', 'primary')))
    .setThumbnail(i.user.displayAvatarURL({ size: 128 }))
    .setDescription(fill(reason.intro || cfg().welcomeMessage || 'Thanks for reaching out, {user}! Staff will be with you shortly.', { user: `<@${i.user.id}>`, username: i.user.username, reason: reason.label }))
    .addFields(
      { name: 'Opened by', value: `<@${i.user.id}> (\`${i.user.username}\`)`, inline: true },
      { name: 'Reason', value: reason.label, inline: true },
      { name: 'Details', value: details.slice(0, 1024) },
    )
    .setTimestamp();

  const pingRole = reason.pingRoleId || cfg().pingRoleId ? String(reason.pingRoleId || cfg().pingRoleId) : null;
  const pings = [`<@${i.user.id}>`, pingRole ? `<@&${pingRole}>` : null].filter(Boolean).join(' ');
  await channel.send({
    content: pings,
    embeds: [embed],
    components: [controlRow('open')],
    allowedMentions: { users: [i.user.id], roles: pingRole ? [pingRole] : [] },
  }).catch((e) => log(`^1Could not post in ticket channel: ${e.message}^7`));

  await i.editReply(`✅ Your ticket has been opened: <#${channel.id}>`);

  await dm(i.user.id, new EmbedBuilder()
    .setColor(colorOf('open', 'primary'))
    .setTitle('🎫 Ticket opened')
    .setDescription(fill(cfg().openDm || 'Your support ticket was opened: {channel}\nStaff will reply there. You will get a message here when it is closed.', { channel: `<#${channel.id}>`, reason: reason.label }))
    .addFields({ name: 'Reason', value: reason.label })
    .setTimestamp());

  await logEvent(new EmbedBuilder()
    .setColor(colorOf('open', 'primary'))
    .setTitle('🎫 Ticket opened')
    .setDescription(`<#${channel.id}> by <@${i.user.id}>\n**Reason:** ${reason.label}`)
    .setTimestamp());
}

async function onClaim(i) {
  const t = ticketInfo(i.channel);
  if (!t) return i.reply(ephemeral('This is not a ticket channel.'));
  if (!isStaff(i)) return i.reply(ephemeral('Only staff can claim tickets.'));
  if (!i.message.embeds[0]) return i.reply(ephemeral('Could not read the ticket message.'));

  const embed = EmbedBuilder.from(i.message.embeds[0]);
  const fields = embed.data.fields || [];
  const current = fields.find((f) => f.name === 'Claimed by');
  const mine = !!(current && current.value.includes(i.user.id));
  if (current && !mine) return i.reply(ephemeral(`This ticket is already claimed by ${current.value}.`));

  await i.deferUpdate();
  const rest = fields.filter((f) => f.name !== 'Claimed by');
  if (mine) embed.setFields(rest);
  else embed.setFields([...rest, { name: 'Claimed by', value: `<@${i.user.id}>`, inline: true }]);
  await i.editReply({ embeds: [embed], components: [controlRow('open', mine ? null : i.user.id)] });

  if (!mine) {
    await i.channel.send({ content: `🙋 <@${i.user.id}> is now handling this ticket.`, allowedMentions: { parse: [] } }).catch(() => {});
    if (cfg().dmOnClaim !== false && i.user.id !== t.ownerId) {
      await dm(t.ownerId, new EmbedBuilder()
        .setColor(colorOf('open', 'primary'))
        .setTitle('🙋 Your ticket was claimed')
        .setDescription(`**${i.user.username}** is now handling your ticket <#${i.channel.id}>.`)
        .setTimestamp());
    }
  }
}

async function onClose(i) {
  const t = ticketInfo(i.channel);
  if (!t) return i.reply(ephemeral('This is not a ticket channel.'));
  if (i.user.id !== t.ownerId && !isStaff(i)) return i.reply(ephemeral('Only the ticket owner or staff can close this ticket.'));
  if (stateOf(i.channel, t.ownerId) !== 'open') return i.reply(ephemeral('This ticket is already closed.'));

  await i.showModal(new ModalBuilder()
    .setCustomId(ID.closeModal)
    .setTitle('Close ticket')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason (optional, sent to the ticket owner)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(500),
    )));
}

async function closeTicket(channel, t, closer, reason, post) {
  await channel.permissionOverwrites.edit(t.ownerId, { SendMessages: false }, { reason: `Ticket closed by ${closer.name}` });

  const embed = new EmbedBuilder()
    .setColor(colorOf('closed', 'danger'))
    .setTitle('🔒 Ticket closed')
    .setDescription((closer.auto ? 'Closed automatically (no activity)' : `Closed by <@${closer.id}>`) + ` <t:${Math.floor(Date.now() / 1000)}:R>` + (reason ? `\n**Reason:** ${reason}` : ''))
    .setFooter({ text: 'Staff: Reopen, Archive or Delete below.' });
  await post({ embeds: [embed], components: [controlRow('closed')], allowedMentions: { parse: [] } });

  const tr = cfg().transcript || {};
  let transcript = null;
  if (tr.enabled !== false) transcript = await buildTranscript(channel).catch(() => null);

  const closedByOwner = !closer.auto && closer.id === t.ownerId;
  const dmEmbed = new EmbedBuilder()
    .setColor(colorOf('closed', 'danger'))
    .setTitle('🔒 Ticket closed')
    .setDescription(fill(cfg().closeDm || 'Your support ticket **{channel}** was closed.', { channel: `#${channel.name}` }))
    .addFields(
      ...(reason ? [{ name: 'Reason', value: reason.slice(0, 1024) }] : []),
      { name: 'Closed by', value: closer.auto ? 'Automatically (inactive)' : closedByOwner ? 'You' : closer.name },
    )
    .setTimestamp();
  const extra = {};
  if (transcript && tr.dmUser !== false) extra.files = [transcript.file()];
  if (cfg().rating !== false) {
    dmEmbed.addFields({ name: 'How did we do?', value: 'Rate the support you got with the buttons below.' });
    extra.components = [ratingRow(channel.id)];
  }
  const dmOk = await dm(t.ownerId, dmEmbed, extra);
  if (!dmOk && !closedByOwner) channel.send({ content: '⚠️ Could not DM the ticket owner (DMs closed).' }).catch(() => {});

  await logEvent(new EmbedBuilder()
    .setColor(colorOf('closed', 'danger'))
    .setTitle('🔒 Ticket closed')
    .setDescription(`#${channel.name} (owner <@${t.ownerId}>) closed by ${closer.auto ? 'auto-close' : `<@${closer.id}>`}` + (reason ? `\n**Reason:** ${reason}` : ''))
    .setTimestamp(), transcript && tr.log !== false ? [transcript.file()] : []);
}

async function onCloseModal(i) {
  const channel = i.channel;
  const t = ticketInfo(channel);
  if (!t) return i.reply(ephemeral('This is not a ticket channel.'));
  if (i.user.id !== t.ownerId && !isStaff(i)) return i.reply(ephemeral('Not allowed.'));
  if (stateOf(channel, t.ownerId) !== 'open') return i.reply(ephemeral('This ticket is already closed.'));
  await i.deferReply();

  const reason = i.fields.getTextInputValue('reason').trim();
  if (i.message) await i.message.edit({ components: [] }).catch(() => {});
  await closeTicket(channel, t, { id: i.user.id, name: i.user.username, auto: false }, reason, (p) => i.editReply(p));
}

async function onRate(i, stars, chId) {
  const n = Math.min(5, Math.max(1, Number(stars) || 0));
  await i.update({
    embeds: [new EmbedBuilder()
      .setColor(colorOf('open', 'primary'))
      .setTitle('Thanks for your feedback!')
      .setDescription(`You rated the support: ${'⭐'.repeat(n)}`)],
    components: [],
  }).catch(() => {});
  await logEvent(new EmbedBuilder()
    .setColor(colorOf('open', 'primary'))
    .setTitle('⭐ Ticket rated')
    .setDescription(`<@${i.user.id}> rated ticket \`${chId}\`: ${'⭐'.repeat(n)} (${n}/5)`)
    .setTimestamp());
}

async function onReopen(i) {
  const t = ticketInfo(i.channel);
  if (!t) return i.reply(ephemeral('This is not a ticket channel.'));
  if (!isStaff(i)) return i.reply(ephemeral('Only staff can reopen tickets.'));
  await i.deferUpdate();

  await i.channel.permissionOverwrites.edit(t.ownerId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true });
  await i.message.edit({ components: [] }).catch(() => {});
  await i.channel.send({
    content: `<@${t.ownerId}>`,
    embeds: [new EmbedBuilder().setColor(colorOf('open', 'primary')).setTitle('🔓 Ticket reopened').setDescription(`Reopened by <@${i.user.id}>`)],
    components: [controlRow('open')],
    allowedMentions: { users: [t.ownerId] },
  });

  await dm(t.ownerId, new EmbedBuilder()
    .setColor(colorOf('open', 'primary'))
    .setTitle('🔓 Ticket reopened')
    .setDescription(`Your support ticket was reopened: <#${i.channel.id}>`)
    .setTimestamp());
  await logEvent(new EmbedBuilder().setColor(colorOf('open', 'primary')).setTitle('🔓 Ticket reopened').setDescription(`<#${i.channel.id}> by <@${i.user.id}>`).setTimestamp());
}

async function onArchive(i) {
  const t = ticketInfo(i.channel);
  if (!t) return i.reply(ephemeral('This is not a ticket channel.'));
  if (!isStaff(i)) return i.reply(ephemeral('Only staff can archive tickets.'));
  await i.deferUpdate();

  await i.channel.permissionOverwrites.edit(t.ownerId, { ViewChannel: false, SendMessages: false });
  if (cfg().archiveCategoryId) await i.channel.setParent(String(cfg().archiveCategoryId), { lockPermissions: false }).catch((e) => log(`^3Could not move to archive category: ${e.message}^7`));
  await i.message.edit({ components: [] }).catch(() => {});
  await i.channel.send({
    embeds: [new EmbedBuilder().setColor(colorOf('archived', 'muted')).setTitle('🗄️ Ticket archived').setDescription(`Archived by <@${i.user.id}>. Only staff can see this channel now.`)],
    components: [controlRow('archived')],
    allowedMentions: { parse: [] },
  });
  await logEvent(new EmbedBuilder().setColor(colorOf('archived', 'muted')).setTitle('🗄️ Ticket archived').setDescription(`<#${i.channel.id}> (owner <@${t.ownerId}>) by <@${i.user.id}>`).setTimestamp());
}

async function onDelete(i) {
  const t = ticketInfo(i.channel);
  if (!t) return i.reply(ephemeral('This is not a ticket channel.'));
  if (!isStaff(i)) return i.reply(ephemeral('Only staff can delete tickets.'));
  await i.deferUpdate();

  await i.message.edit({ components: [] }).catch(() => {});
  await i.channel.send('🗑️ Deleting this ticket in 5 seconds...');
  await logEvent(new EmbedBuilder().setColor(colorOf('closed', 'danger')).setTitle('🗑️ Ticket deleted').setDescription(`#${i.channel.name} (owner <@${t.ownerId}>) by <@${i.user.id}>`).setTimestamp());
  const ch = i.channel;
  setTimeout(() => ch.delete(`Ticket deleted by ${i.user.tag}`).catch(() => {}), 5000);
}

let sweepTimer = null;

async function sweep() {
  const hours = Number(cfg().autoCloseHours) || 0;
  if (!cfg().enabled || !hours) return;
  const guild = client.guilds.cache.get(String(config.guildId || '')) || client.guilds.cache.first();
  if (!guild) return;

  for (const c of guild.channels.cache.values()) {
    const t = ticketInfo(c);
    if (!t || stateOf(c, t.ownerId) !== 'open') continue;
    const lastActivity = SnowflakeUtil.timestampFrom(c.lastMessageId || c.id);
    if (Date.now() - lastActivity < hours * 3600000) continue;
    try {
      await closeTicket(c, t, { id: client.user.id, name: 'Auto-close', auto: true }, `No activity for ${hours} hours.`, (p) => c.send(p));
    } catch (err) {
      log(`^3Auto-close failed for #${c.name}: ${err.message}^7`);
    }
  }
}

function startTimers() {
  stopTimers();
  if (!cfg().enabled || !(Number(cfg().autoCloseHours) > 0)) return;
  sweepTimer = setInterval(() => sweep().catch(() => {}), 10 * 60 * 1000);
  setTimeout(() => sweep().catch(() => {}), 30 * 1000);
}

function stopTimers() {
  if (sweepTimer) clearInterval(sweepTimer);
  sweepTimer = null;
}

function owns(i) {
  return typeof i.customId === 'string' && i.customId.startsWith(PREFIX);
}

async function handle(i) {
  if (!cfg().enabled) {
    if (i.isRepliable()) i.reply(ephemeral('Tickets are turned off.')).catch(() => {});
    return;
  }
  const [kind, arg, arg2] = i.customId.split(':');
  if (!i.guild && kind !== ID.rate) return;
  try {
    if (i.isStringSelectMenu()) {
      if (kind === ID.select) return await onSelect(i);
    } else if (i.isButton()) {
      if (kind === ID.claim) return await onClaim(i);
      if (kind === ID.close) return await onClose(i);
      if (kind === ID.reopen) return await onReopen(i);
      if (kind === ID.archive) return await onArchive(i);
      if (kind === ID.del) return await onDelete(i);
      if (kind === ID.rate) return await onRate(i, arg, arg2);
    } else if (i.isModalSubmit()) {
      if (kind === ID.open) return await onOpen(i, arg);
      if (kind === ID.closeModal) return await onCloseModal(i);
    }
  } catch (err) {
    logger.error('Ticket error', err.stack || String(err));
    const msg = ephemeral('Something went wrong. (Does the bot have Manage Channels / Manage Roles?)');
    if (i.deferred || i.replied) i.followUp(msg).catch(() => {});
    else i.reply(msg).catch(() => {});
  }
}

module.exports = { handle, owns, panelMessage, ticketInfo, stateOf, isStaff, buildTranscript, startTimers, stopTimers };
