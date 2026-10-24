const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const hook = require('../lib/hook');
const { isAllowed, theme, escapeMd } = require('../lib/util');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a player from the game server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addIntegerOption((o) => o.setName('id').setDescription('Player server ID (see /players)').setRequired(true).setMinValue(1))
    .addStringOption((o) => o.setName('reason').setDescription('Reason shown to the player')),

  async execute(interaction) {
    if (!isAllowed(interaction)) return interaction.reply({ content: 'No permission.', flags: MessageFlags.Ephemeral });
    const id = String(interaction.options.getInteger('id'));
    const reason = interaction.options.getString('reason') || 'No reason given';
    const name = GetPlayerName(id);
    if (!name) return interaction.reply({ content: `No player with ID ${id} is online.`, flags: MessageFlags.Ephemeral });

    DropPlayer(id, `Kicked by ${interaction.user.username}: ${reason}`);
    await interaction.reply({ content: `👢 Kicked **${escapeMd(name)}** (ID ${id}).`, flags: MessageFlags.Ephemeral });

    hook.send('logs', {
      name: 'Moderation',
      embeds: [{ title: '👢 Player kicked', color: theme('secondary'), description: `**${escapeMd(name)}** (ID ${id}) kicked by <@${interaction.user.id}>\n**Reason:** ${escapeMd(reason)}` }],
    }).catch(() => {});
  },
};
