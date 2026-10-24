const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
} = require('discord.js');
const client = require('./client');
const { config, theme, parseColor, channelId, fill } = require('./util');
const logger = require('./logger');

const cfg = () => config.whitelist || {};
const colorOf = (key, fallbackKey) => parseColor((cfg().colors || {})[key], theme(fallbackKey));
const ephemeral = (content) => ({ content, flags: MessageFlags.Ephemeral });
const log = (...a) => console.log('^5[p_fxserverbot]^7', ...a);

const ID = {
  apply: 'wl_apply',
  submit: 'wl_submit',
  accept: 'wl_accept',
  deny: 'wl_deny',
  denyModal: 'wl_denymodal',
};

const cooldowns = new Map();
function panelMessage() {
  const p = cfg().panel || {};
  const embed = new EmbedBuilder()
    .setTitle(fill(p.title || 'Whitelist Application'))
    .setDescription(fill(p.description || 'Press the button below and fill in the form.'))
    .setColor(parseColor(p.color, theme('primary')));
  if (p.imageUrl && /^https?:\/\//i.test(p.imageUrl)) embed.setImage(p.imageUrl);
  if (p.footer) embed.setFooter({ text: fill(p.footer) });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(ID.apply)
      .setLabel(String(p.buttonLabel || 'Apply for Whitelist').slice(0, 80))
      .setEmoji('📝')
      .setStyle(ButtonStyle.Primary),
  );
  return { embeds: [embed], components: [row] };
}

const questions = () => (cfg().questions || []).filter((q) => q && q.label).slice(0, 5);

function buildModal() {
  const modal = new ModalBuilder()
    .setCustomId(ID.submit)
    .setTitle(String(cfg().modalTitle || 'Whitelist Application').slice(0, 45));

  questions().forEach((q, i) => {
    const paragraph = q.style === 'paragraph';
    const input = new TextInputBuilder()
      .setCustomId(`q${i}`)
      .setLabel(String(q.label).slice(0, 45))
      .setStyle(paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(q.required !== false)
      .setMaxLength(Math.min(Number(q.maxLength) || (paragraph ? 1000 : 200), 1000));
    if (q.minLength) input.setMinLength(Math.min(Number(q.minLength), 1000));
    if (q.placeholder) input.setPlaceholder(String(q.placeholder).slice(0, 100));
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  });
  return modal;
}

function canReview(i) {
  if (i.memberPermissions && i.memberPermissions.has('Administrator')) return true;
  const own = (cfg().reviewerRoleIds || []).map(String);
  const roles = own.length ? own : (config.adminRoleIds || []).map(String);
  if (!roles.length) return !!(i.memberPermissions && i.memberPermissions.has('ManageGuild'));
  return !!(i.member && i.member.roles && i.member.roles.cache && i.member.roles.cache.some((r) => roles.includes(r.id)));
}

async function onApply(i) {
  if (!questions().length) return i.reply(ephemeral('The whitelist form has no questions yet. Tell an admin.'));

  const roleId = cfg().whitelistRoleId;
  if (roleId && i.member && i.member.roles && i.member.roles.cache && i.member.roles.cache.has(String(roleId))) {
    return i.reply(ephemeral('You are already whitelisted.'));
  }

  const waitMs = (Number(cfg().cooldownMinutes) || 0) * 60000;
  const last = cooldowns.get(i.user.id);
  if (waitMs && last && Date.now() - last < waitMs) {
    const until = Math.floor((last + waitMs) / 1000);
    return i.reply(ephemeral(`You already applied recently. You can apply again <t:${until}:R>.`));
  }

  await i.showModal(buildModal());
}

async function onSubmit(i) {
  const waitMs = (Number(cfg().cooldownMinutes) || 0) * 60000;
  const last = cooldowns.get(i.user.id);
  if (waitMs && last && Date.now() - last < waitMs) {
    return i.reply(ephemeral('You already applied recently. Please wait before applying again.'));
  }
  const wlRole = cfg().whitelistRoleId;
  if (wlRole && i.member && i.member.roles && i.member.roles.cache && i.member.roles.cache.has(String(wlRole))) {
    return i.reply(ephemeral('You are already whitelisted.'));
  }
  cooldowns.set(i.user.id, Date.now());

  const reviewCh = await client.channels.fetch(channelId(cfg().reviewChannel)).catch(() => null);
  if (!reviewCh || !reviewCh.isTextBased()) {
    log('^1whitelist.reviewChannel is not set or the bot cannot see it.^7');
    return i.reply(ephemeral('Applications are not available right now. Please contact staff.'));
  }

  const user = i.user;
  const lines = [
    `**Applicant:** <@${user.id}> (\`${user.username}\`)`,
    `**User ID:** \`${user.id}\``,
    `**Account created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
  ];
  if (i.member && i.member.joinedTimestamp) lines.push(`**Joined server:** <t:${Math.floor(i.member.joinedTimestamp / 1000)}:R>`);
  const minDays = Number(cfg().minAccountAgeDays) || 0;
  if (minDays && (Date.now() - user.createdTimestamp) / 86400000 < minDays) lines.push(`⚠️ **New account** (younger than ${minDays} days)`);

  const embed = new EmbedBuilder()
    .setTitle('📝 New Whitelist Application')
    .setColor(colorOf('pending', 'pending'))
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setDescription(lines.join('\n'));

  questions().forEach((q, idx) => {
    const answer = i.fields.getTextInputValue(`q${idx}`);
    embed.addFields({ name: String(q.label).slice(0, 256), value: (answer || '*No answer*').slice(0, 1024) });
  });
  embed
    .addFields({ name: 'Status', value: '🟡 Pending review' })
    .setFooter({ text: `Applicant ID: ${user.id}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${ID.accept}:${user.id}`).setLabel('Accept').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${ID.deny}:${user.id}`).setLabel('Deny').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  );

  const pingRole = cfg().pingRoleId ? String(cfg().pingRoleId) : null;
  let sent;
  try {
    sent = await reviewCh.send({
      content: pingRole ? `<@&${pingRole}>` : undefined,
      embeds: [embed],
      components: [row],
      allowedMentions: { roles: pingRole ? [pingRole] : [], users: [] },
    });
  } catch (err) {
    log(`^1Could not post application: ${err.message}^7`);
    return i.reply(ephemeral('Could not send your application. Please contact staff.'));
  }

  if (cfg().createThread && sent && sent.startThread) {
    sent.startThread({ name: `app-${user.username}`.slice(0, 90), autoArchiveDuration: 1440 }).catch(() => {});
  }

  cooldowns.set(user.id, Date.now());
  if (cfg().dmApplicant !== false && cfg().dmOnSubmit !== false) {
    user.send({ embeds: [new EmbedBuilder()
      .setColor(colorOf('pending', 'pending'))
      .setTitle('Whitelist application received')
      .setDescription(fill(cfg().submitMessage || 'We received your whitelist application. You will get a message here when staff has reviewed it.'))] }).catch(() => {});
  }
  await i.reply(ephemeral('✅ Your application was sent to the staff. You will get a message when it has been reviewed.'));
}

function decidedEmbed(old, kind, reviewer, reason, notes) {
  const accepted = kind === 'accepted';
  const embed = EmbedBuilder.from(old);
  const fields = (embed.data.fields || []).filter((f) => f.name !== 'Status' && f.name !== 'Reason');
  const when = Math.floor(Date.now() / 1000);

  embed
    .setTitle(accepted ? '✅ Whitelist Application: Accepted' : '❌ Whitelist Application: Denied')
    .setColor(accepted ? colorOf('accepted', 'success') : colorOf('denied', 'danger'))
    .setFields(fields);

  if (!accepted && reason) embed.addFields({ name: 'Reason', value: reason.slice(0, 1024) });
  embed.addFields({
    name: 'Status',
    value: [`${accepted ? '✅ Accepted' : '❌ Denied'} by <@${reviewer.id}> <t:${when}:R>`, ...notes].join('\n'),
  });
  return embed;
}

async function dmApplicant(userId, kind, reason) {
  if (cfg().dmApplicant === false) return null;
  const accepted = kind === 'accepted';
  const text = accepted ? cfg().acceptMessage : cfg().denyMessage;
  const embed = new EmbedBuilder()
    .setColor(accepted ? colorOf('accepted', 'success') : colorOf('denied', 'danger'))
    .setTitle(accepted ? 'Whitelist accepted' : 'Whitelist denied')
    .setDescription(fill(text || (accepted ? 'Your whitelist application was accepted. Welcome!' : 'Your whitelist application was denied.')));
  if (!accepted && reason) embed.addFields({ name: 'Reason', value: reason.slice(0, 1024) });
  try {
    const user = await client.users.fetch(userId);
    await user.send({ embeds: [embed] });
    return null;
  } catch (_) {
    return '⚠️ Could not DM the applicant (DMs closed).';
  }
}

async function onAccept(i, userId) {
  if (!canReview(i)) return i.reply(ephemeral('You are not allowed to review applications.'));
  await i.deferUpdate();

  const notes = [];
  const roleId = cfg().whitelistRoleId;
  if (roleId) {
    try {
      const member = await i.guild.members.fetch(userId);
      await member.roles.add(String(roleId));
      notes.push(`🏷️ Gave <@&${roleId}>`);
    } catch (err) {
      log(`^1Could not give whitelist role: ${err.message}^7`);
      notes.push('⚠️ Could not give the whitelist role (user left, or the bot lacks Manage Roles / its role is too low).');
    }
  }
  const dmNote = await dmApplicant(userId, 'accepted');
  if (dmNote) notes.push(dmNote);

  const answers = {};
  for (const f of (i.message.embeds[0].fields || [])) if (f.name !== 'Status' && f.name !== 'Reason') answers[f.name] = f.value;
  const applicant = await client.users.fetch(userId).catch(() => null);
  emit('p_fxserverbot:whitelistAccepted', userId, applicant ? applicant.username : '', answers);

  await i.editReply({ embeds: [decidedEmbed(i.message.embeds[0], 'accepted', i.user, null, notes)], components: [] });
}

async function onDeny(i, userId) {
  if (!canReview(i)) return i.reply(ephemeral('You are not allowed to review applications.'));

  const modal = new ModalBuilder()
    .setCustomId(`${ID.denyModal}:${userId}`)
    .setTitle('Deny application')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason (sent to the applicant)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(500),
    ));
  await i.showModal(modal);
}

async function onDenyModal(i, userId) {
  if (!canReview(i)) return i.reply(ephemeral('You are not allowed to review applications.'));
  if (!i.isFromMessage()) return;
  await i.deferUpdate();

  const reason = i.fields.getTextInputValue('reason').trim();
  const notes = [];
  const dmNote = await dmApplicant(userId, 'denied', reason);
  if (dmNote) notes.push(dmNote);

  await i.editReply({ embeds: [decidedEmbed(i.message.embeds[0], 'denied', i.user, reason, notes)], components: [] });
}

async function handle(i) {
  if (!cfg().enabled || !i.guild) return;
  const [kind, arg] = i.customId.split(':');

  try {
    if (i.isButton()) {
      if (kind === ID.apply) return await onApply(i);
      if (kind === ID.accept) return await onAccept(i, arg);
      if (kind === ID.deny) return await onDeny(i, arg);
    } else if (i.isModalSubmit()) {
      if (kind === ID.submit) return await onSubmit(i);
      if (kind === ID.denyModal) return await onDenyModal(i, arg);
    }
  } catch (err) {
    logger.error('Whitelist error', err.stack || String(err));
    const msg = ephemeral('Something went wrong.');
    if (i.deferred || i.replied) i.followUp(msg).catch(() => {});
    else i.reply(msg).catch(() => {});
  }
}

async function setRole(guild, userId, give) {
  const roleId = cfg().whitelistRoleId;
  if (!roleId) throw new Error('whitelist.whitelistRoleId is not set in config.json');
  const member = await guild.members.fetch(userId);
  if (give) await member.roles.add(String(roleId)); else await member.roles.remove(String(roleId));
  emit(give ? 'p_fxserverbot:whitelistAccepted' : 'p_fxserverbot:whitelistRemoved', userId, member.user.username, {});
  return member;
}

module.exports = { handle, panelMessage, setRole };
