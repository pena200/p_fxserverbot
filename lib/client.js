const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { config } = require('./util');
const intents = [GatewayIntentBits.Guilds];
const w = config.welcome || {};
if (w.enabled || (w.goodbye && w.goodbye.enabled) || (w.autoRoleIds && w.autoRoleIds.length)) intents.push(GatewayIntentBits.GuildMembers);
if ((config.dmReply || {}).enabled) intents.push(GatewayIntentBits.DirectMessages);
module.exports = new Client({ intents, partials: [Partials.Channel, Partials.Message] });
