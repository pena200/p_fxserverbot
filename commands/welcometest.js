const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { isAllowed } = require('../lib/util');
const welcome = require('../lib/welcome');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcometest')
    .setDescription('Preview the welcome message (only you see it)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!isAllowed(interaction)) {
      return interaction.reply({ content: 'No permission.', flags: MessageFlags.Ephemeral });
    }
    await interaction.reply({ embeds: [welcome.buildEmbed(interaction.member)], flags: MessageFlags.Ephemeral });
  },
};
