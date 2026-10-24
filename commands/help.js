const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { theme } = require('../lib/util');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('List all bot commands'),

  async execute(interaction) {
    const list = require('./index');
    const lines = list
      .map((c) => `**/${c.data.name}**: ${c.data.description}`)
      .join('\n');
    const embed = new EmbedBuilder()
      .setTitle('🤖 Commands')
      .setColor(theme('primary'))
      .setDescription(lines.slice(0, 4000))
      .setFooter({ text: 'Some commands are staff only.' });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
