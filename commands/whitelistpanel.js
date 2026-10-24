const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { isAllowed } = require('../lib/util');
const whitelist = require('../lib/whitelist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelistpanel')
    .setDescription('Post the whitelist application panel (button + form) in a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) =>
      o.setName('channel').setDescription('Where to post it (default: this channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),

  async execute(interaction) {
    if (!isAllowed(interaction)) {
      return interaction.reply({ content: 'No permission.', flags: MessageFlags.Ephemeral });
    }
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    try {
      await channel.send(whitelist.panelMessage());
      await interaction.reply({ content: `Panel posted in <#${channel.id}>.`, flags: MessageFlags.Ephemeral });
    } catch (err) {
      await interaction.reply({ content: `Failed: ${err.message}\n(Bot needs View Channel, Send Messages and Embed Links there.)`, flags: MessageFlags.Ephemeral });
    }
  },
};
