const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { isAllowed, theme } = require('../lib/util');

const NUMS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a reaction poll')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((o) => o.setName('question').setDescription('The question').setRequired(true))
    .addStringOption((o) => o.setName('option1').setDescription('Option 1 (leave all empty for a yes/no poll)'))
    .addStringOption((o) => o.setName('option2').setDescription('Option 2'))
    .addStringOption((o) => o.setName('option3').setDescription('Option 3'))
    .addStringOption((o) => o.setName('option4').setDescription('Option 4')),

  async execute(interaction) {
    if (!isAllowed(interaction)) return interaction.reply({ content: 'No permission.', flags: MessageFlags.Ephemeral });
    const opts = [1, 2, 3, 4].map((n) => interaction.options.getString(`option${n}`)).filter(Boolean);
    const yesNo = opts.length < 2;
    const emojis = yesNo ? ['👍', '👎'] : NUMS.slice(0, opts.length);
    const desc = yesNo ? 'React with 👍 or 👎' : opts.map((o, i) => `${NUMS[i]} ${o}`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(theme('primary'))
      .setTitle(`📊 ${interaction.options.getString('question')}`.slice(0, 256))
      .setDescription(desc)
      .setFooter({ text: `Poll by ${interaction.user.username}` })
      .setTimestamp();
    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    for (const e of emojis) await msg.react(e).catch(() => {});
  },
};
