const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { isAllowed, reloadConfig } = require('../lib/util');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reloadconfig')
    .setDescription('Reload config.json without restarting (texts, colors, questions, roles)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAllowed(interaction)) return interaction.reply({ content: 'No permission.', flags: MessageFlags.Ephemeral });
    try {
      reloadConfig();
      emit('p_fxserverbot:configReloaded');
      await interaction.reply({ content: '✅ config.json reloaded. (Token, intents, update intervals and the command list need a resource restart. Rich presence was re-sent to all players.)', flags: MessageFlags.Ephemeral });
    } catch (err) {
      await interaction.reply({ content: `❌ config.json is invalid, nothing changed: ${err.message}`, flags: MessageFlags.Ephemeral });
    }
  },
};
