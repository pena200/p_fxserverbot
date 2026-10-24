const { SlashCommandBuilder, PermissionFlagsBits: P, MessageFlags } = require('discord.js');
const tickets = require('../lib/tickets');

const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage the ticket you are in (staff only)')
    .setDefaultMemberPermissions(P.ManageMessages)
    .addSubcommand((s) => s.setName('add').setDescription('Add a member to this ticket')
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand((s) => s.setName('remove').setDescription('Remove a member from this ticket')
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand((s) => s.setName('rename').setDescription('Rename this ticket channel')
      .addStringOption((o) => o.setName('name').setDescription('New name').setRequired(true).setMaxLength(60)))
    .addSubcommand((s) => s.setName('transcript').setDescription('Get a text transcript of this ticket')),

  async execute(interaction) {
    const t = tickets.ticketInfo(interaction.channel);
    if (!t) return interaction.reply(eph('Use this inside a ticket channel.'));
    if (!tickets.isStaff(interaction)) return interaction.reply(eph('Staff only.'));

    const sub = interaction.options.getSubcommand();
    const ch = interaction.channel;

    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      await ch.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true });
      return interaction.reply({ content: `➕ <@${user.id}> was added to this ticket.`, allowedMentions: { users: [user.id] } });
    }
    if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      if (user.id === t.ownerId) return interaction.reply(eph('You cannot remove the ticket owner. Use Archive instead.'));
      await ch.permissionOverwrites.delete(user.id);
      return interaction.reply({ content: `➖ <@${user.id}> was removed from this ticket.`, allowedMentions: { parse: [] } });
    }
    if (sub === 'rename') {
      const name = interaction.options.getString('name').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'ticket';
      await ch.setName(name);
      return interaction.reply(eph(`Renamed to #${name}.`));
    }
    if (sub === 'transcript') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const tr = await tickets.buildTranscript(ch);
      return interaction.editReply({ content: `Transcript (${tr.count} messages):`, files: [tr.file()] });
    }
  },
};
