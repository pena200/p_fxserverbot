fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'Pena'
description 'Discord bot for FXServer, it handles tickets, whitelists, welcome messages, DMs auto-replies for users, status of server and other slash commands that have added/can be added'
version '1.0.0'

dependency 'yarn'

client_scripts {
    'client.lua',
}

server_scripts {
    'index.js',
    'server.lua',
}