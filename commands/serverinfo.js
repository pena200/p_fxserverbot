const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { theme, formatUptime } = require('../lib/util');

const startedAt = Date.now();

module.exports = {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('Show info about the game server'),

  async execute(interaction) {
    const players = GetNumPlayerIndices();
    const max = GetConvarInt('sv_maxclients', 48);
    const name = GetConvar('sv_projectName', '') || GetConvar('sv_hostname', 'FiveM server');
    const embed = new EmbedBuilder()
      .setTitle(`🖥️ ${String(name).replace(/\^\d/g, '').slice(0, 200)}`)
      .setColor(theme('primary'))
      .addFields(
        { name: 'Players', value: `${players}/${max}`, inline: true },
        { name: 'Uptime', value: formatUptime(Date.now() - startedAt), inline: true },
        { name: 'Resources', value: String(GetNumResources()), inline: true },
        { name: 'Bot ping', value: `${interaction.client.ws.ping} ms`, inline: true },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};
