const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const client = require('../lib/client');
const { isAllowed } = require('../lib/util');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbot')
    .setDescription("Change the bot's own name and/or avatar")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) => o.setName('name').setDescription('New bot name'))
    .addAttachmentOption((o) => o.setName('avatar').setDescription('New bot avatar image')),

  async execute(interaction) {
    if (!isAllowed(interaction)) {
      return interaction.reply({ content: 'No permission.', flags: MessageFlags.Ephemeral });
    }
    const name = interaction.options.getString('name');
    const avatar = interaction.options.getAttachment('avatar');
    if (!name && !avatar) return interaction.reply({ content: 'Give a name and/or an avatar.', flags: MessageFlags.Ephemeral });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      if (name) await client.user.setUsername(name);
      if (avatar) await client.user.setAvatar(avatar.url);
      await interaction.editReply('Bot updated. (Discord limits this to about 2 name changes per hour.)');
    } catch (err) {
      await interaction.editReply(`Failed: ${err.message}`);
    }
  },
};
