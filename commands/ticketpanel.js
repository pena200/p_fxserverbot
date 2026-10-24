const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { isAllowed } = require('../lib/util');
const tickets = require('../lib/tickets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Post the support ticket panel (reason dropdown) in a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) =>
      o.setName('channel').setDescription('Where to post it (default: this channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),

  async execute(interaction) {
    if (!isAllowed(interaction)) {
      return interaction.reply({ content: 'No permission.', flags: MessageFlags.Ephemeral });
    }
    const msg = tickets.panelMessage();
    if (!msg.components.length) {
      return interaction.reply({ content: 'No reasons set in config.json -> tickets.reasons.', flags: MessageFlags.Ephemeral });
    }
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    try {
      await channel.send(msg);
      await interaction.reply({ content: `Ticket panel posted in <#${channel.id}>.`, flags: MessageFlags.Ephemeral });
    } catch (err) {
      await interaction.reply({ content: `Failed: ${err.message}\n(Bot needs View Channel, Send Messages and Embed Links there.)`, flags: MessageFlags.Ephemeral });
    }
  },
};
