const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { isAllowed } = require('../lib/util');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete the latest messages in this channel (max 100, not older than 14 days)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) => o.setName('amount').setDescription('How many messages').setRequired(true).setMinValue(1).setMaxValue(100)),

  async execute(interaction) {
    if (!isAllowed(interaction)) return interaction.reply({ content: 'No permission.', flags: MessageFlags.Ephemeral });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const deleted = await interaction.channel.bulkDelete(interaction.options.getInteger('amount'), true);
      await interaction.editReply(`🧹 Deleted ${deleted.size} message(s).`);
    } catch (err) {
      await interaction.editReply(`Failed: ${err.message}\n(Bot needs **Manage Messages** here.)`);
    }
  },
};
