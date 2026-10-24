const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { isAllowed } = require('../lib/util');
const dm = require('../lib/dm');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dmtest')
    .setDescription('Preview the automatic reply people get when they message the bot (only you see it)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!isAllowed(interaction)) return interaction.reply({ content: 'No permission.', flags: MessageFlags.Ephemeral });
    await interaction.reply({ ...dm.buildReply(interaction.user), flags: MessageFlags.Ephemeral });
  },
};
