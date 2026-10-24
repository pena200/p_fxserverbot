const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { isAllowed } = require('../lib/util');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an announcement to everyone in the game')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((o) => o.setName('message').setDescription('Announcement text').setRequired(true).setMaxLength(500)),

  async execute(interaction) {
    if (!isAllowed(interaction)) {
      return interaction.reply({ content: 'No permission.', flags: MessageFlags.Ephemeral });
    }
    const message = interaction.options.getString('message').replace(/\^\d/g, '').slice(0, 500);
    emit('p_fxserverbot:announce', interaction.user.username, message);
    await interaction.reply({ content: 'Announcement sent in-game.', flags: MessageFlags.Ephemeral });
  },
};
