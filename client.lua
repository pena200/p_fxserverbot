local cfg = nil
local customVars = {}
local lastKey = nil

local COMPASS = { 'N', 'NW', 'W', 'SW', 'S', 'SE', 'E', 'NE' }

local DEFAULT_ACTIVITIES = {
    pause = 'In the pause menu',
    dead = 'Down',
    driving = 'Driving',
    passenger = 'Riding along',
    motorcycle = 'Riding',
    bicycle = 'Cycling',
    boat = 'Sailing',
    heli = 'Flying a helicopter',
    plane = 'Flying a plane',
    swimming = 'Swimming',
    skydiving = 'Skydiving',
    sprinting = 'Sprinting',
    running = 'Running',
    walking = 'Walking',
    idle = 'Standing around',
}

local function act(key)
    local custom = cfg and cfg.activities
    if type(custom) == 'table' and type(custom[key]) == 'string' and custom[key] ~= '' then return custom[key] end
    return DEFAULT_ACTIVITIES[key]
end

local function label(text, fallback)
    if not text or text == '' then return fallback end
    local l = GetLabelText(text)
    if not l or l == '' or l == 'NULL' then return fallback end
    return l
end

local function truncate(text, max)
    if #text <= max then return text end
    local cut = utf8.offset(text, max + 1)
    return (cut and text:sub(1, cut - 1) or text:sub(1, max))
end

local function activityFor(ped, veh)
    if IsPauseMenuActive() then return act('pause') end
    if IsEntityDead(ped) then return act('dead') end

    if veh ~= 0 then
        local class = GetVehicleClass(veh)
        if class == 15 then return act('heli') end
        if class == 16 then return act('plane') end
        if class == 14 then return act('boat') end
        if class == 13 then return act('bicycle') end
        if class == 8 then return act('motorcycle') end
        if GetPedInVehicleSeat(veh, -1) == ped then return act('driving') end
        return act('passenger')
    end

    if IsPedSwimming(ped) or IsPedSwimmingUnderWater(ped) then return act('swimming') end
    if IsPedFalling(ped) or GetPedParachuteState(ped) > 0 then return act('skydiving') end
    if IsPedSprinting(ped) then return act('sprinting') end
    if IsPedRunning(ped) then return act('running') end
    if IsPedWalking(ped) then return act('walking') end
    return act('idle')
end

local function collect()
    local ped = PlayerPedId()
    local pos = GetEntityCoords(ped)
    local veh = GetVehiclePedIsIn(ped, false)

    local h1, h2 = GetStreetNameAtCoord(pos.x, pos.y, pos.z)
    local zone = label(GetNameOfZone(pos.x, pos.y, pos.z), 'San Andreas')
    local street = GetStreetNameFromHashKey(h1)
    if not street or street == '' then street = zone end
    local crossing = (h2 and h2 ~= 0) and GetStreetNameFromHashKey(h2) or ''

    local heading = GetEntityHeading(ped)
    local direction = COMPASS[(math.floor(((heading + 22.5) % 360) / 45)) + 1]

    local vehicle, speed = 'On foot', ''
    if veh ~= 0 then
        vehicle = label(GetDisplayNameFromVehicleModel(GetEntityModel(veh)), 'Vehicle')
        local mps = GetEntitySpeed(veh)
        if cfg and cfg.speedUnit == 'mph' then
            speed = ('%d mph'):format(math.floor(mps * 2.236936 + 0.5))
        else
            speed = ('%d km/h'):format(math.floor(mps * 3.6 + 0.5))
        end
    end

    local state = GlobalState
    local vars = {
        name = GetPlayerName(PlayerId()) or 'Player',
        id = GetPlayerServerId(PlayerId()),
        street = street,
        crossing = crossing,
        zone = zone,
        direction = direction,
        vehicle = vehicle,
        speed = speed,
        activity = activityFor(ped, veh),
        players = state['p_fxserverbot:players'] or '?',
        max = state['p_fxserverbot:max'] or '?',
        server = cfg and cfg.serverName or '',
    }
    for k, v in pairs(customVars) do vars[k] = v end
    return vars
end

local function fill(text, vars)
    return (tostring(text or ''):gsub('{(%w+)}', function(k)
        local v = vars[k]
        if v == nil then return '{' .. k .. '}' end
        return tostring(v)
    end))
end

local function currentText(vars)
    local list = cfg.texts
    if type(list) ~= 'table' or #list == 0 then list = { '{name} | {street} | {players}/{max}' } end
    local rotate = math.max(3, tonumber(cfg.rotateSeconds) or 10) * 1000
    local i = (math.floor(GetGameTimer() / rotate) % #list) + 1
    return truncate(fill(list[i], vars), 128)
end

local function apply()
    if not cfg or not cfg.enabled or not cfg.appId or cfg.appId == '' then return end
    local vars = collect()
    local text = currentText(vars)
    local largeText = truncate(fill(cfg.largeText or '', vars), 128)
    local smallText = truncate(fill(cfg.smallText or '', vars), 128)

    local key = text .. '\0' .. largeText .. '\0' .. smallText
    if key == lastKey then return end
    lastKey = key

    SetRichPresence(text)
    SetDiscordRichPresenceAssetText(largeText)
    SetDiscordRichPresenceAssetSmallText(smallText)
end

local function setup(newCfg)
    cfg = newCfg
    lastKey = nil
    if not cfg or not cfg.enabled or not cfg.appId or cfg.appId == '' then return end

    SetDiscordAppId(cfg.appId)
    if cfg.largeImage and cfg.largeImage ~= '' then SetDiscordRichPresenceAsset(cfg.largeImage) end
    if cfg.smallImage and cfg.smallImage ~= '' then SetDiscordRichPresenceAssetSmall(cfg.smallImage) end
    for i, b in ipairs(cfg.buttons or {}) do
        if i > 2 then break end
        SetDiscordRichPresenceAction(i - 1, b.label, b.url)
    end
    apply()
end

RegisterNetEvent('p_fxserverbot:rp:config', function(newCfg)
    if type(newCfg) == 'table' then setup(newCfg) end
end)

-- Other resources can add their own placeholders, e.g. {job}:
--   exports.p_fxserverbot:setPresenceVar('job', 'Police')
exports('setPresenceVar', function(key, value)
    if type(key) ~= 'string' or not key:match('^%w+$') then return false end
    if value == nil then customVars[key] = nil else customVars[key] = tostring(value) end
    return true
end)

CreateThread(function()
    while not NetworkIsSessionStarted() do Wait(500) end
    TriggerServerEvent('p_fxserverbot:rp:request')

    while true do
        if cfg and cfg.enabled then apply() end
        Wait(math.max(2, tonumber(cfg and cfg.updateSeconds) or 5) * 1000)
    end
end)
