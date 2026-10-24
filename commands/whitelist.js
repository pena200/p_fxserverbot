const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { isAllowed } = require('../lib/util');
const whitelist = require('../lib/whitelist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Give or remove the whitelist role without an application')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('add').setDescription('Whitelist a member')
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand((s) => s.setName('remove').setDescription('Remove the whitelist from a member')
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))),

  async execute(interaction) {
    if (!isAllowed(interaction)) return interaction.reply({ content: 'No permission.', flags: MessageFlags.Ephemeral });
    const give = interaction.options.getSubcommand() === 'add';
    const user = interaction.options.getUser('user');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await whitelist.setRole(interaction.guild, user.id, give);
      await interaction.editReply(give ? `✅ <@${user.id}> is now whitelisted.` : `✅ Whitelist removed from <@${user.id}>.`);
    } catch (err) {
      await interaction.editReply(`Failed: ${err.message}\n(Needs \`whitelist.whitelistRoleId\`, **Manage Roles**, and the bot's role above the whitelist role.)`);
    }
  },
};
