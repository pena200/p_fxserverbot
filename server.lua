local RES = GetCurrentResourceName()
local cfg = json.decode(LoadResourceFile(RES, 'config.json') or '{}') or {}
local theme = cfg.theme or {}
local CYAN = theme.primary or '#00d4ff'
local BLUE = theme.secondary or '#0077ff'
local NAVY = theme.muted or '#0b3a5b'

local function esc(text)
    text = tostring(text or '')
    text = text:gsub('[%*_~`|>%[%]%(%)#\\-]', '\\%0')
    text = text:gsub('@', '@\226\128\139')
    return text
end

local function stamp()
    return os.date('!%Y-%m-%dT%H:%M:%SZ')
end

local function playerCount()
    return GetNumPlayerIndices()
end

AddEventHandler('p_fxserverbot:announce', function(author, message)
    TriggerClientEvent('chat:addMessage', -1, {
        color = { 0, 212, 255 },
        multiline = true,
        args = { 'ANNOUNCEMENT', message },
    })
end)

AddEventHandler('p_fxserverbot:whitelistAccepted', function(discordId, username, answers)
    print(('[%s] Whitelist accepted: %s (%s)'):format(RES, username, discordId))
end)

AddEventHandler('p_fxserverbot:whitelistRemoved', function(discordId, username)
    print(('[%s] Whitelist removed: %s (%s)'):format(RES, username, discordId))
end)

if cfg.logJoinLeave then
    AddEventHandler('playerJoining', function()
        local src = source
        pcall(function()
            exports[RES]:sendEmbed('logs', 'Join / Leave Log', {
                title = '📥 Player joined',
                description = ('**%s** (ID %s)'):format(esc(GetPlayerName(src) or 'Unknown'), src),
                color = CYAN,
                footer = { text = ('%d online'):format(playerCount()) },
                timestamp = stamp(),
            })
        end)
    end)

    AddEventHandler('playerDropped', function(reason)
        local src = source
        pcall(function()
            exports[RES]:sendEmbed('logs', 'Join / Leave Log', {
                title = '📤 Player left',
                description = ('**%s** (ID %s)\n%s'):format(esc(GetPlayerName(src) or 'Unknown'), src, esc(reason or '')),
                color = NAVY,
                footer = { text = ('%d online'):format(math.max(playerCount() - 1, 0)) },
                timestamp = stamp(),
            })
        end)
    end)
end

if cfg.logChat then
    AddEventHandler('chatMessage', function(src, name, message)
        if not message or message:sub(1, 1) == '/' then return end
        pcall(function()
            exports[RES]:sendMessage('chatLogs', name or 'Chat', ('💬 %s'):format(esc(message)))
        end)
    end)
end

if cfg.logServerStart then
    CreateThread(function()
        Wait(8000)
        pcall(function()
            exports[RES]:sendEmbed('logs', 'Server Status', {
                title = '🟢 Server started',
                description = 'The server is online. Have fun!',
                color = BLUE,
                timestamp = stamp(),
            })
        end)
    end)
end

local function stripColors(text)
    return (tostring(text or ''):gsub('%^%d', ''))
end

local function safeUrl(url)
    url = tostring(url or '')
    if url:match('^https?://') or url:match('^fivem://') or url:match('^cfx%.re/join/') then
        if url:match('^cfx%.re/') then url = 'https://' .. url end
        return url
    end
    return nil
end

local function buildRichPresence()
    local fresh = json.decode(LoadResourceFile(RES, 'config.json') or '') or cfg
    local rp = fresh.richPresence or {}

    local name = rp.serverName
    if not name or name == '' then name = GetConvar('sv_projectName', '') end
    if not name or name == '' then name = GetConvar('sv_hostname', 'FiveM server') end

    local buttons = {}
    for _, b in ipairs(rp.buttons or {}) do
        local url = safeUrl(b.url)
        if url and b.label and b.label ~= '' and #buttons < 2 then
            buttons[#buttons + 1] = { label = tostring(b.label):sub(1, 32), url = url }
        end
    end

    return {
        enabled = rp.enabled ~= false and rp.appId ~= nil and tostring(rp.appId) ~= '',
        appId = tostring(rp.appId or ''),
        serverName = stripColors(name):sub(1, 60),
        texts = type(rp.texts) == 'table' and rp.texts or nil,
        updateSeconds = tonumber(rp.updateSeconds) or 5,
        rotateSeconds = tonumber(rp.rotateSeconds) or 10,
        largeImage = tostring(rp.largeImage or ''),
        largeText = tostring(rp.largeText or ''),
        smallImage = tostring(rp.smallImage or ''),
        smallText = tostring(rp.smallText or ''),
        speedUnit = rp.speedUnit == 'mph' and 'mph' or 'kmh',
        buttons = buttons,
        activities = type(rp.activities) == 'table' and rp.activities or {},
    }
end

local rpCooldown = {}

RegisterNetEvent('p_fxserverbot:rp:request', function()
    local src = source
    local now = GetGameTimer()
    if rpCooldown[src] and now - rpCooldown[src] < 2000 then return end
    rpCooldown[src] = now
    TriggerClientEvent('p_fxserverbot:rp:config', src, buildRichPresence())
end)

AddEventHandler('playerDropped', function() rpCooldown[source] = nil end)

AddEventHandler('p_fxserverbot:configReloaded', function()
    TriggerClientEvent('p_fxserverbot:rp:config', -1, buildRichPresence())
end)

CreateThread(function()
    GlobalState['p_fxserverbot:max'] = GetConvarInt('sv_maxclients', 48)
    local last = -1
    while true do
        local n = GetNumPlayerIndices()
        if n ~= last then
            last = n
            GlobalState['p_fxserverbot:players'] = n
        end
        Wait(5000)
    end
end)
