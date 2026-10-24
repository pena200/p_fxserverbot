const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { config, theme, escapeMd, isAllowed } = require('../lib/util');

module.exports = {
  data: new SlashCommandBuilder().setName('players').setDescription('Show who is online on the server'),

  async execute(interaction) {
    const ids = [];
    for (let i = 0; i < GetNumPlayerIndices(); i++) ids.push(GetPlayerFromIndex(i));
    const max = GetConvarInt('sv_maxclients', 48);
    const showDiscord = !!(config.players && config.players.showDiscord) && isAllowed(interaction);

    const lines = ids
      .map((id) => ({ id: Number(id), name: GetPlayerName(id), ping: GetPlayerPing(id), discord: GetPlayerIdentifierByType(id, 'discord') }))
      .sort((a, b) => a.id - b.id)
      .slice(0, 40)
      .map((p) => `\`${p.id}\` **${escapeMd(p.name)}** · ${p.ping}ms` + (showDiscord && p.discord ? ` · <@${String(p.discord).replace('discord:', '')}>` : ''));

    const embed = new EmbedBuilder()
      .setTitle(`Players online: ${ids.length}/${max}`)
      .setColor(theme('primary'))
      .setDescription(lines.length ? lines.join('\n') : 'Nobody online.')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};
