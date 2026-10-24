const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags } = require('discord.js');
const hook = require('../lib/hook');
const { config, isAllowed, parseColor } = require('../lib/util');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a message to a channel with a custom name and avatar')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption((o) =>
      o.setName('channel').setDescription('Where to send it')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread)
        .setRequired(true))
    .addStringOption((o) =>
      o.setName('name').setDescription('Name to show (pick a preset or type your own)')
        .setAutocomplete(true).setRequired(true))
    .addStringOption((o) =>
      o.setName('message').setDescription('Message (use \\n for a new line)').setRequired(true))
    .addStringOption((o) => o.setName('avatar').setDescription('Avatar image URL (optional)'))
    .addBooleanOption((o) => o.setName('embed').setDescription('Send as an embed'))
    .addStringOption((o) => o.setName('title').setDescription('Embed title (only with embed)'))
    .addStringOption((o) => o.setName('color').setDescription('Embed color hex, e.g. #00d4ff')),

  async autocomplete(interaction) {
    const typed = interaction.options.getFocused().toLowerCase();
    const list = Object.keys(config.presets || {})
      .filter((n) => n.toLowerCase().includes(typed))
      .slice(0, 25)
      .map((n) => ({ name: n, value: n }));
    await interaction.respond(list);
  },

  async execute(interaction) {
    if (!isAllowed(interaction)) {
      return interaction.reply({ content: 'No permission.', flags: MessageFlags.Ephemeral });
    }

    const channel = interaction.options.getChannel('channel');
    const name = interaction.options.getString('name');
    const message = interaction.options.getString('message').replace(/\\n/g, '\n');
    const avatar = interaction.options.getString('avatar');
    const asEmbed = interaction.options.getBoolean('embed');
    const title = interaction.options.getString('title');
    const color = interaction.options.getString('color');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const ok = await hook.send(channel.id, {
        name,
        avatar,
        content: asEmbed ? undefined : message,
        embeds: asEmbed ? [{ title: title || undefined, description: message, color: parseColor(color) }] : [],
      });
      await interaction.editReply(ok ? `Sent to <#${channel.id}> as **${name}**.` : 'Could not send (channel not found or bot not ready).');
    } catch (err) {
      await interaction.editReply(`Failed: ${err.message}\n(Bot needs **Manage Webhooks** in that channel. Names can't contain "discord" or "clyde".)`);
    }
  },
};
