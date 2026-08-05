/*global bootstrap */
/*global domtoimage */

export let config = { playlistName: "playlist" }

let registeredPlaylistIds = []

function setElementVisibility(htmlElement, newVis) {
    let oldclass = htmlElement.getAttribute("class")
    if (newVis) {
        htmlElement.setAttribute("class", oldclass.replaceAll("visually-hidden", ""))
    } else {
        htmlElement.setAttribute("class", oldclass + " visually-hidden")
    }
}

export function dateToRelativeString(date) {
    if (!date.getDate()) return ""
    let days = Math.round((date - Date.now()) / 86400000)
    
    let formatter = new Intl.RelativeTimeFormat("en", {numeric: "auto"})

    if (Math.abs(days) > 365) {
        let years = Math.round(days / 365)
        return formatter.format(years, "year")
    } else if (Math.abs(days) > 30) {
        let months = Math.round(days / 30)
        return formatter.format(months, "month")
    } else if (Math.abs(days) > 7) {
        let weeks = Math.round(days / 7)
        return formatter.format(weeks, "week")
    }

    return formatter.format(days, "day")
}

function dragstartHandler(ev, id) {
    ev.dataTransfer.setData("text", id)
}

function dragoverHandler(ev) {
    ev.preventDefault()
}

function dropHandler(ev, id) {
    ev.preventDefault()
    const data = ev.dataTransfer.getData("text")
    console.log(`${data} dropped on ${id}`)
    moveBefore(Number(data), Number(id))
    
}

class GameInfo { 
    constructor(id, title, timeStamp, addedBy = 'unk') {
        this.id = id
        this.title = title
        this.timeStamp = new Date(timeStamp)
        this.addedBy = addedBy
    }

    createTile(forAdd=false) {
        let gameTile = document.createElement("div")
        gameTile.setAttribute("class", "gametile mx-2 my-2")
        gameTile.setAttribute("gameId", this.id)
        gameTile.setAttribute("addedBy", this.addedBy)

        if (!forAdd) {
            gameTile.setAttribute("draggable", true)
            gameTile.addEventListener("dragstart", ev => dragstartHandler(ev, this.id))
            gameTile.addEventListener("drop", ev => dropHandler(ev, this.id))
            gameTile.addEventListener("dragover", ev => dragoverHandler(ev))
        }

        let card = gameTile.appendChild(document.createElement("div"))
        card.setAttribute("class", "card shadow-sm")
        let image = card.appendChild(document.createElement("img"))
        image.setAttribute("class", "gameimage rounded")
        if (coverMap.has(this.id))
            image.setAttribute("src", coverMap.get(this.id))    
        else
            image.setAttribute("src", "resource/missing_cover.png")
        let gameoverlay = card.appendChild(document.createElement("div"))
        gameoverlay.setAttribute("class", "gameoverlay")
        let gamecontrolvis = card.appendChild(document.createElement("div"))
        gamecontrolvis.setAttribute("class", "gamecontrolvisibility rounded")
        gamecontrolvis = gamecontrolvis.appendChild(document.createElement("div"))
        gamecontrolvis.setAttribute("class", "gamecontrolcontent")
        let controls = gamecontrolvis.appendChild(document.createElement("div"))
        controls.setAttribute("class", "gamecontrols bg-body-tertiary")
        let title = controls.appendChild(document.createElement("div"))
        title.setAttribute("class", "gametitle text-center text-truncate px-2")
        title.setAttribute("title", this.title)
        title.textContent = this.title
        if (forAdd)
            this.populateControlsForAdd(controls)
        else
            this.populateControlsForPlaylist(controls)
        let viewButton = controls.querySelector("#controlgroup").appendChild(document.createElement("button"))
        viewButton.setAttribute("class", "btn btn-sm btn-outline-secondary")
        viewButton.addEventListener("click", populateViewGameModal)
        viewButton.setAttribute("type", "button")
        viewButton.textContent = "View"
        return gameTile
    }
    
    populateControlsForPlaylist(controls) {
        let bottom = controls.appendChild(document.createElement("div"))
        bottom.setAttribute("class", "d-flex justify-content-between align-items-center")
        let buttongroup = bottom.appendChild(document.createElement("div"))
        buttongroup.setAttribute("class", "btn-group")
        buttongroup.setAttribute("id", "controlgroup")
        let removeButton = buttongroup.appendChild(document.createElement("button"))
        removeButton.setAttribute("class", "btn btn-sm btn-outline-secondary")
        removeButton.addEventListener("click", () => removeGame(this.id, this.title))
        removeButton.setAttribute("type", "button")
        removeButton.textContent = "Remove"
        let timeStamp = bottom.appendChild(document.createElement("small"))
        timeStamp.setAttribute("class", "text-body-secondary")
        timeStamp.textContent = "Added " + dateToRelativeString(this.timeStamp)
    }
    
    populateControlsForAdd(controls) {
        let bottom = controls.appendChild(document.createElement("div"))
        bottom.setAttribute("class", "d-flex justify-content-between align-items-center")
        let buttongroup = bottom.appendChild(document.createElement("div"))
        buttongroup.setAttribute("class", "btn-group")
        buttongroup.setAttribute("id", "controlgroup")
        let addButton = buttongroup.appendChild(document.createElement("button"))
        addButton.setAttribute("type", "button")
        addButton.addEventListener("click", () => addButtonClicked(addButton, this.id, this.title))
        if (registeredPlaylistIds.indexOf(this.id) == -1) {
            addButton.setAttribute("class", "btn btn-sm btn-outline-secondary")
            addButton.textContent = "Add"
        } else {
            addButton.setAttribute("class", "btn btn-success btn-sm btn-outline-secondary")
            addButton.textContent = "Added"
        }
    }
}

function setTileSize(tileSizeInput) {
    viewSettings.tileSize = tileSizeInput.value
    document.documentElement.style.setProperty("--gametile-size", `${tileSizeInput.value}px`)
    tileSizeInput.parentElement.querySelector('label').textContent = `Tile Size: ${tileSizeInput.value}`
}
document.getElementById("tileSizeInput").addEventListener("input", ev => setTileSize(ev.srcElement))

function addButtonClicked(addButton, id, title) {
    if (registeredPlaylistIds.indexOf(id) == -1) {
        addGame(id, title)
        addButton.setAttribute("class", "btn btn-success btn-sm btn-outline-secondary")
        addButton.textContent = "Added"
    } else {
        removeGame(id, title)
        addButton.setAttribute("class", "btn addButton btn-sm btn-outline-secondary")
        addButton.textContent = "Add"
    }
}

export async function postServer(requestbody) {
    return await fetch(config.serveraddress, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(requestbody)
    })
}

let coverMap = new Map()
async function preloadCovers(rawJson) {
    let ids = []
    for (let game of rawJson['Games']) {
        if (!coverMap.has(game['id']))
            ids.push(game['id'])
    }
    ids.sort()

    let response = await postServer({
            "op" : "getCovers",
            "ids" : ids
        })

    if (response.ok) {
        let body = await response.json()
        for (let pair of body['Covers']) {
            coverMap.set(pair[0], "https:" + pair[1].replace("t_thumb", `t_cover_big${viewSettings.tileSize <= 250 ? "" : "_2x"}`))
            updateImageForGameId(pair[0])
        }

        if (body['Covers'].length > 0 && body['Covers'].length < ids.length)
            preloadCovers(rawJson)
    }
}

export let gameFieldsMap = new Map()
export async function preloadGameFields(ids, fields, postprocessfn = (e => e), gameTypes = null) {
    ids = ids.filter(id => {
        let info = gameFieldsMap.get(id)
        if (info) {
            for (let field of fields) {
                if (!(field in info)) return true
            }
            return false
        }
        return true
    })
    ids = ids.sort()

    let doFetch = async function(withIds) {
        let body = {
            "op" : "getGameFields",
            "ids" : withIds,
            "fields" : fields
        }
        if (gameTypes) body["game_types"] = gameTypes
        let response = await postServer(body)

        if (response.ok) {
            let body = await response.json()
            return body['Games']
        }
    }

    let lastResponseLen = -1
    while (ids.length > 0 && lastResponseLen != 0) {
        let batch = await doFetch(ids)
        lastResponseLen = batch.length
        for (let game of batch) {
            game = postprocessfn(game)
            if ('id' in game) {
                let info = gameFieldsMap.get(game['id'])
                if (!info) {
                    info = {}
                }
                for (let field of fields) {
                    info[field] = game[field]
                }
                gameFieldsMap.set(game['id'], info)
            }
            ids = ids.filter(val => val != game['id'])
        }
    }
}

export async function preloadReleaseInfo() {
    let ids = [...document.getElementsByClassName("gametile")].map(gameTile => Number(gameTile.getAttribute("gameId")))

    await preloadGameFields(ids, ['first_release_date'], game => {
        if (!('first_release_date' in game))
            game['first_release_date'] = "TBA"
        else
            game['first_release_date'] *= 1000
        return game
    })
}

let last_pop_type = 1
async function getPopular(offset = 0, num = 30, pop_type = 1 + Math.floor(Math.random() * 8)) {
    if (offset > 0) {
        pop_type = last_pop_type
    }
    last_pop_type = pop_type


    let response = await postServer({
        "op" : "getPopular",
        "num" : num,
        "pop_type" : pop_type,
        "offset" : offset
    })

    if (response.ok) {
        let body = await response.json()
        return body['Games']
    }

    return []
}

export async function preloadWebsites(ids = [...document.getElementsByClassName("gametile")].map(gameTile => Number(gameTile.getAttribute("gameId")))) {
    ids = ids.filter(id => (gameFieldsMap.has(id) && !gameFieldsMap.get(id).websites))
    
    let doFetch = async function(withIds) {
        let response = await postServer({
            "op" : "getWebsites",
            "ids" : withIds
        })

        if (response.ok) {
            let body = await response.json()
            return body['Games']
        }
    }

    let lastResponseLen = -1
    while (ids.length > 0 && lastResponseLen != 0) {
        let batch = await doFetch(ids)
        lastResponseLen = batch.length
        for (let game of batch) {
            if ('id' in game && 'websites' in game) {
                let info = gameFieldsMap.get(game['id'])
                if (!info) {
                    info = {}
                }
                info['websites'] = game['websites']
                gameFieldsMap.set(game['id'], info)
                ids = ids.filter(val => val != game['id'])
            }
        }
    }
}

export async function preloadPrice(id) {
    let response = await postServer({
        "op" : "getPrice",
        "id" : id
    })

    if (response.ok) {
        let body = await response.json()
        let info = gameFieldsMap.get(id)
        if (!info) {
            info = {}
        }
        info['price'] = body['Price']
        gameFieldsMap.set(id, info)
    }

}

async function loadFranchise(ids) {
    let response = await postServer({
        "op" : "getFranchises",
        "ids" : ids
    })

    if (response.ok) {
        let body = await response.json()
        return body['Franchises']
    }
}

let howLongToBeatMap = new Map()
export async function preloadHowLongToBeat(ids = [...document.getElementsByClassName("gametile")].map(t=>Number(t.getAttribute('gameId')))) {
    ids = ids.filter(e=>!howLongToBeatMap.has(e))
    ids.sort()

    let doFetch = async function(withIds) {
        let response = await postServer({
            "op" : "getHltb",
            "ids" : withIds
        })

        if (response.ok) {
            let body = await response.json()
            return body['Games']
        }
    }

    let lastResponseLen = -1
    while (ids.length > 0 && lastResponseLen != 0) {
        let batch = await doFetch(ids)
        lastResponseLen = batch.length
        for (let game of batch) {
            howLongToBeatMap.set(game['id'], game['hltb'])
            ids = ids.filter(val => val != game['id'])
        }
    }

    return howLongToBeatMap
}

let videosMap = new Map()
export async function preloadVideos() {
    let ids = []
    for (let gameInfo of gameFieldsMap) {
        if (gameInfo[1].videos)
            for (let id of gameInfo[1].videos)
                if (!videosMap.has(id))
                    ids.push(id)
    }
    ids.sort()

    let doFetch = async function(withIds) {
        let response = await postServer({
            "op" : "getVideos",
            "ids" : withIds
        })

        if (response.ok) {
            let body = await response.json()
            return body['Videos']
        }
    }

    let lastResponseLen = -1
    while (ids.length > 0 && lastResponseLen != 0) {
        let batch = await doFetch(ids)
        lastResponseLen = batch.length
        for (let video of batch) {
            if ('id' in video && 'video_id' in video)
                videosMap.set(video['id'], video['video_id'])
            ids = ids.filter(val => val != video['id'])
        }
    }

    return videosMap
}

let playDataMap = new Map()
export function resetPlayData() {
    playDataMap = new Map()
}

export async function preloadPlayData(ids = [...document.getElementsByClassName("gametile")].map(t=>Number(t.getAttribute('gameId')))) {
    ids = ids.filter(e=>!playDataMap.has(Number(e)))
    ids.sort()

    let doFetch = async function(withIds) {
        let response = await postServer({
            "op" : "getPlayData",
            "ids" : withIds
        })

        if (response.ok) {
            let body = await response.json()
            return body['PlayData']
        }
    }

    let lastResponseLen = -1
    while (ids.length > 0 && lastResponseLen != 0) {
        let batch = await doFetch(ids)
        lastResponseLen = batch.length
        for (let playDataId in batch) {
            playDataMap.set(Number(playDataId), batch[playDataId])
            ids = ids.filter(e=> e != Number(playDataId))
        }
    }

    return playDataMap
}

export async function preloadPlatformInfo() {
    let ids = [...document.getElementsByClassName("gametile")].map(gameTile => Number(gameTile.getAttribute("gameId")))

    await preloadGameFields(ids, ['platforms'])
}

let platformMetaMap = new Map()
export async function preloadPlatformMetaInfo() {
    let ids = []
    for (let gameInfo of gameFieldsMap) {
        if(gameInfo[1].platforms)
            for (let id of gameInfo[1].platforms)
                if (!platformMetaMap.has(id))
                    ids.push(id)
    }
    ids.sort()

    let doFetch = async function(withIds) {
        let response = await postServer({
            "op" : "getPlatforms",
            "ids" : withIds
        })

        if (response.ok) {
            let body = await response.json()
            return body['Platforms']
        }
    }

    let lastResponseLen = -1
    while (ids.length > 0 && lastResponseLen != 0) {
        let batch = await doFetch(ids)
        lastResponseLen = batch.length
        for (let game of batch) {
            if ('id' in game && 'name' in game && 'slug' in game)
                platformMetaMap.set(game['id'], { name : game['name'], slug : game['slug']})
            ids = ids.filter(val => val != game['id'])
        }
    }

    return platformMetaMap
}


let platformIcons = new Map()
export async function getPlatformIcon(slug) {
    if (platformIcons.has(slug))
        return platformIcons.get(slug)

    let response = await fetch(`resource/platform_icon/${slug}.svg`)
    if (response.ok) {
        platformIcons.set(slug, response.text())
    } else {
        platformIcons.set(slug, (await getPlatformIcon("missing")).replace("</svg>", `<text x="0" y="8" style="font-size:7px">${slug}</text></svg>`))
    }

    return platformIcons.get(slug)
}


async function updateImageForGameId(id) {
    let tiles = [...document.getElementsByClassName("gametile")].filter(t => Number(t.getAttribute("gameId")) == id)
    let cover = coverMap.get(id)
    for (let tile of tiles) {
        tile.querySelector(".gameimage").setAttribute("src", cover)
    }
}

async function refreshPlaylist() {
    let gametilecontainer = document.getElementById("gametilecontainer")
    gametilecontainer.innerHTML = ''

    registeredPlaylistIds = []
    resetPlayData()

    let spinner = document.getElementById("playlist-loading-spinner")
    setElementVisibility(spinner, true)
    setElementVisibility(gametilecontainer, false)
    
    let response = null

    try {
        response = await fetch(`${config.serveraddress}/${config.playlistName}`, {
            method: 'GET'
        })
    } catch (e) {
        if (e instanceof TypeError) {
            alert("The server could not be reached. Perhaps your browser is blocking it due to my bad SSL certificate? Pressing ok will attempt to connect to the server directly. If your browser warns you, press the 'Take me there anyway' button, then come back here.")
            location.href = config.serveraddress
        } 
    }
    
    if (response.ok) {
        let json = await response.json()
        
        preloadCovers(json)
        
        let tileContainer = document.getElementById("gametilecontainer")
        for (let game of json['Games']) {
            registeredPlaylistIds.push(game['id'])
            let g = new GameInfo(game['id'], game['name'], game['addedTimestamp'], game['addedBy'])
            tileContainer.appendChild(g.createTile())
        } 
    }
        
    await doViewSettings()

    setElementVisibility(spinner, false)
    setElementVisibility(gametilecontainer, true)
    
    addAdditionalDataForPlaylist()    
}
document.getElementById("refreshPlaylist").addEventListener("click", refreshPlaylist)

async function addAdditionalDataForPlaylist() {
    let gametilecontainer = document.getElementById("gametilecontainer")
    let gameTiles = gametilecontainer.getElementsByClassName('gametile')

    for (let tile of gameTiles) {
        let visuals = tile.querySelector("#gameTileVisuals")
        if (visuals) {
            visuals.outerHTML = ""
        }
        let visDiv = document.createElement("div")
        visDiv.setAttribute("id", "gameTileVisuals")
        tile.querySelector(".gametitle").after(visDiv)
        for (let visual of gameTileVisuals)
            await visual.applyPlaylist(tile)
    }
}

async function addAdditionalDataForAdd() {
    let gametilecontainer = document.getElementById("addgametilecontainer")
    let gameTiles = gametilecontainer.getElementsByClassName('gametile')

    for (let tile of gameTiles) {
        let visuals = tile.querySelector("#gameTileVisuals")
        if (visuals) {
            visuals.outerHTML = ""
        }
        let visDiv = document.createElement("div")
        visDiv.setAttribute("id", "gameTileVisuals")
        tile.querySelector(".gametitle").after(visDiv)
        for (let visual of gameTileVisuals)
            await visual.applyAdd(tile)
    }
}

function removeGame(id) {
    postServer({
        "playlist" : config.playlistName,
        "op" : "sub",
        "id" : id
    }).then(response => {
        if (response.ok) {
            refreshPlaylist()
        }
    })
}

function addGame(id) {
    postServer({
        "playlist" : config.playlistName,
        "op" : "add",
        "id" : id,
        "user" : config.userName
    }).then(response => {
        if (response.ok) {
            refreshPlaylist()
        }
    })
}

function moveBefore(firstId, secondId) {
    postServer({
        "playlist" : config.playlistName,
        "op" : "moveBefore",
        "id1" : firstId,
        "id2" : secondId
    }).then(response => {
        if (response.ok) {
            //alert(`Adding Game ${id}, ${title}`)
            refreshPlaylist()
        }
    })
}

async function GetNote(id) {
    let response = await postServer({
        "playlist" : config.playlistName,
        "op" : "getNote",
        "id" : id
    })

    if (response.ok) {
        let json = await response.json()
        return json['Note']
    }
}

function SetNote(id, note) {
    postServer({
        "playlist" : config.playlistName,
        "op" : "setNote",
        "id" : id,
        "note" : note
    })
}

window.onload = function() {
    let myModalEl = document.getElementById('addGameModal')
    myModalEl.addEventListener('hidden.bs.modal', () => {
        resetAddGame()
    })
    myModalEl.addEventListener('shown.bs.modal', () => {
        initAddGame()
    })
    
    myModalEl = document.getElementById('settingsModal')
    myModalEl.addEventListener('hidden.bs.modal', () => {
        cancelViewSettings()
    })
    
    myModalEl = document.getElementById('clientSettingsModal')
    myModalEl.addEventListener('shown.bs.modal', () => {
        loadConfigFromLocalStorage()
    })
    
    myModalEl = document.getElementById('viewGameModal')
    myModalEl.addEventListener('hidden.bs.modal', () => {
        resetViewGameModal()
    })

    let notesEl = document.getElementById("notes")
    notesEl.addEventListener('input', () => {
        onNotesInput()
    })

    for (let method of sortMethods) {
        method.createDOMOption()
    }

    for (let method of groupMethods) {
        method.createDOMOption()
    }

    for (let visual of gameTileVisuals) {
        visual.createDOMOption()
    }

    resetAddGame()
    cancelViewSettings()

    if (!loadConfigFromLocalStorage()) {
        (new bootstrap.Modal("#clientSettingsModal")).show()
    } else {
        refreshPlaylist()
    }

    let urlParams = new URLSearchParams(window.location.search)
    if (urlParams.has("showGame")) {
        populateViewGameModalWithGame(Number(urlParams.get("showGame")), "Game")
    }
}

let searchTimeout
function OnSearch(input) {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
        UpdateSearch(input.value)
    }, 1000)
}
document.getElementById('searchInput').addEventListener("input", () => OnSearch(document.getElementById("searchInput")))

function UpdateSearch(val) {
    console.log(val)
    let regex = new RegExp(val.toLowerCase())
    let tiles = document.getElementsByClassName("gametile")
    for (let tile of tiles) {
        let title = tile.querySelector(".gametitle").textContent
        if (regex.test(title.toLowerCase())) {
            tile.hidden = false
        } else {
            tile.hidden = true
        }
    }
}

let addSearchTimeout
function OnSearchForAdd() {
    clearTimeout(addSearchTimeout)
    addSearchTimeout = setTimeout(() => {
        UpdateAddSearch()
    }, 1000)
}
document.getElementById('addSearchInput').addEventListener("input", () => OnSearchForAdd())

async function createAddGameTiles(gameInfos) {
    let addgametilecontainer = document.querySelector("#addgametilecontainer")
    for (let game of gameInfos)
        addgametilecontainer.appendChild(game.createTile(true))
    addAdditionalDataForAdd()
}

async function doSearchQuery(query, offset = 0) {
    if (offset == 0) {
        let addgametilecontainer = document.querySelector("#addgametilecontainer")
        addgametilecontainer.innerHTML = ''
    }

    let spinner = document.getElementById("addgame-loading-spinner")
    spinner.setAttribute("class", "")
    
    let response = await postServer({
        "op" : "search",
        "query" : query,
        "offset" : offset
    })

    if (response.ok) {
        let body = await response.json()
        preloadCovers(body)
        let infos = body['Games'].map(game => new GameInfo(game['id'], game['name'], Date.now()))
        createAddGameTiles(infos)
    }

    spinner = document.getElementById("addgame-loading-spinner")
    spinner.setAttribute("class", "visually-hidden")
}

function UpdateAddSearch() {
    let query = document.querySelector("#addSearchInput").value
    if (query == "") {
        resetAddGame()
        addPopularGames()
    }
    else {
        doSearchQuery(query)
    }
}

let loadNextLocked = false
async function LoadNextAddGamePage() {
    if (!loadNextLocked) {
        loadNextLocked = true
        
        let query = document.querySelector("#addSearchInput").value
        if (query == "") {
            // add more popular
            await addPopularGames(document.querySelector("#addgametilecontainer").childElementCount)
        }
        else {
            // add more from search
            await doSearchQuery(query, document.querySelector("#addgametilecontainer").childElementCount)
        }

        loadNextLocked = false
    }
}

function resetAddGame() {
    document.querySelector("#addgametilecontainer").textContent=''
    document.querySelector("#addSearchInput").value = ''
}
document.getElementById("addGameModalButton").addEventListener("click", resetAddGame)

async function addPopularGames(offset = 0) {
    let spinner = document.getElementById("addgame-loading-spinner")
    spinner.setAttribute("class", "")

    let popularIds = await getPopular(offset)

    let body = { Games : popularIds.map(e => {return {id : e}})}
    preloadCovers(body)
    
    preloadGameFields(popularIds, ['name']).then(() => {
        createAddGameTiles(popularIds.map(id => new GameInfo(id, gameFieldsMap.get(id).name, Date.now())))
    })

    spinner = document.getElementById("addgame-loading-spinner")
    spinner.setAttribute("class", "visually-hidden")
}

async function initAddGame() {
    await addPopularGames()
}

function onAddGameScrollEnd(divEl) {
    if (Math.abs(divEl.scrollTop - divEl.scrollHeight + divEl.clientHeight) <= 1) {
        console.log("scrolled to bottom!")

        LoadNextAddGamePage()
    }
}
document.getElementById("addGameScrollDiv").addEventListener("scrollend", ev => onAddGameScrollEnd(ev.srcElement))

let viewSettings = {
    groupBy : "",
    sortBy : "",
    sortDir : "asc",
    showfields : [],
    tileDisplay : "crop",
    tileSize : 200
}

let sortMethods = []

class SortMethod {
    constructor(name, displayName, methodAsyncFn) {
        this.name = name
        this.displayName = displayName
        this.doSort = methodAsyncFn
    }

    register() {
        if (sortMethods.find(e => e.name == this.name))
            console.error(`SortMethod already registered! ${this.name}`)

        sortMethods.push(this)
    }

    createDOMOption() {
        let newOption = document.querySelector("#sortby").appendChild(document.createElement("option"))
        newOption.setAttribute("value", this.name)
        newOption.textContent = this.displayName
    }

    async sort() {
        let gametilecontainer = document.getElementById("gametilecontainer")
        let gameTiles = [...gametilecontainer.getElementsByClassName("gametile")]

        await this.doSort(gameTiles)

        if (viewSettings.sortDir == "asc")
            gameTiles.reverse()

        gameTiles.forEach(t => gametilecontainer.appendChild(t))
    }
}

export function registerSortMethod(name, displayName, methodAsyncFn) {
    let method = new SortMethod(name, displayName, methodAsyncFn)
    method.register()
}

let groupMethods = []

export class GroupMethod {
    constructor(name, displayName, methodAsyncFn) {
        this.name = name
        this.displayName = displayName
        this.doGroups = methodAsyncFn
    }

    register() {
        if (groupMethods.find(e => e.name == this.name))
            console.error(`GroupMethod already registered! ${this.name}`)

        groupMethods.push(this)
    }

    createDOMOption() {
        let newOption = document.querySelector("#groupby").appendChild(document.createElement("option"))
        newOption.setAttribute("value", this.name)
        newOption.textContent = this.displayName
    }

    static Category(inDisplayName) {
        return {
            displayName : inDisplayName,
            tiles : [],
            push : function(tile) {
                this.tiles.push(tile)
            },
            toString : function() {
                return this.displayName
            }
        }
    }

    async group() {
        let gametilecontainer = document.getElementById("gametilecontainer")
        let gameTiles = [...gametilecontainer.getElementsByClassName("gametile")]

        let categories = await this.doGroups(gameTiles)

        categories.forEach(category => {
            let categoryHeader = document.createElement("div")
            categoryHeader.setAttribute("class", "gamecategoryheader")
            categoryHeader.innerHTML = `<h1><b>${category.displayName}</b></h1>`
            gametilecontainer.appendChild(categoryHeader)

            for (let tile of category.tiles) {
                gametilecontainer.appendChild(tile)
            }
        })
    }
}

export function registerGroupMethod(name, displayName, methodAsyncFn) {
    let method = new GroupMethod(name, displayName, methodAsyncFn)
    method.register()
}

let gameTileVisuals = []

class GameTileVisual {
    constructor(name, displayName, methodAsyncFn, appliesToPlaylist = true, appliesToAdd = false, needsGameFields = []) {
        this.name = name
        this.displayName = displayName
        this.methodAsyncFn = methodAsyncFn
        this.appliesToPlaylist = appliesToPlaylist
        this.appliesToAdd = appliesToAdd
        this.needsGameFields = needsGameFields
    }

    register() {
        if (gameTileVisuals.find(e => e.name == this.name))
            console.error(`GameTileVisual already registered! ${this.name}`)

        gameTileVisuals.push(this)
    }

    async applyPlaylist(tile) {
        if (this.appliesToPlaylist)
            await this.apply(tile)
    }

    async applyAdd(tile) {
        if (this.appliesToAdd)
            await this.apply(tile)
    }

    async apply(tile) {
        if (viewSettings.showfields.find(e => e == this.name))
            await this.methodAsyncFn(tile)
    }

    createDOMOption() {
        let div = document.querySelector("#showfields").appendChild(document.createElement("div"))
        div.setAttribute("class", "form-check form-switch form-check-inline")
        let checkbox = div.appendChild(document.createElement("input"))
        checkbox.setAttribute("type", "checkbox")
        checkbox.setAttribute("role", "switch")
        checkbox.setAttribute("id", `showfield-${this.name}`)
        checkbox.setAttribute("showfield", this.name)
        checkbox.setAttribute("class", "form-check-input")
        let label = div.appendChild(document.createElement("label"))
        label.setAttribute("class", "form-check-label")
        label.setAttribute("for", `showfield-${this.name}`)
        label.textContent = this.displayName
    }
}

export function registerGameTileVisual(name, displayName, methodAsyncFn, appliesToPlaylist = true, appliesToAdd = false) {
    let visual = new GameTileVisual(name, displayName, methodAsyncFn, appliesToPlaylist, appliesToAdd)
    visual.register()
}

export const ViewModalExtensionType = Object.freeze({
    Main : 'main',
    Sidebar : 'sidebar',
    SidebarTop : 'sidebar-top',
})

let viewModalExtensions = []

class ViewModalExtension {
    constructor(name, displayName, methodAsyncFn, type = ViewModalExtensionType.Sidebar) {
        this.type = type
        this.name = name
        this.displayName = displayName
        this.methodAsyncFn = methodAsyncFn
    }

    register() {
        if (viewModalExtensions.find(e => e.name == this.name))
            console.error(`ViewModalExtension already registered! ${this.name}`)

        viewModalExtensions.push(this)
    }

    async apply(gameId, modalBody) {
        let carddiv = document.createElement("div")
        modalBody.querySelector(`#viewModalExtensionContainer-${this.type}`).appendChild(carddiv)

        carddiv.setAttribute("id", `viewModalExtension-${this.name}`)
        carddiv.setAttribute("class", "card shadow-sm rounded-4 p-4 mb-2")
        carddiv.innerHTML = `<h5>${this.displayName}</h5>`
        await this.methodAsyncFn(carddiv, gameId, modalBody)
    }
}

export function registerViewModalExtension(name, displayName, methodAsyncFn, type = ViewModalExtensionType.Sidebar) {
    let extension = new ViewModalExtension(name, displayName, methodAsyncFn, type)
    extension.register()
}

async function applyViewModalExtensions(gameId, modalBody) {
    for (let extension of viewModalExtensions) {
        await extension.apply(gameId, modalBody)
    }
}

let linkButtonMap = new Map()
export function registerLinkButton(urlRegexPattern, buttonHtml) {
    linkButtonMap.set(urlRegexPattern, buttonHtml)
}

function getLinkButton(url) {
    for (let linkButton of linkButtonMap) {
        if (url.match(linkButton[0])) {
            return linkButton[1]
        }
    }

    return `
                <button class="btn btn-md btn-store-steam">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-globe" viewBox="0 0 16 16">
                        <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m7.5-6.923c-.67.204-1.335.82-1.887 1.855A8 8 0 0 0 5.145 4H7.5zM4.09 4a9.3 9.3 0 0 1 .64-1.539 7 7 0 0 1 .597-.933A7.03 7.03 0 0 0 2.255 4zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a7 7 0 0 0-.656 2.5zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5zM8.5 5v2.5h2.99a12.5 12.5 0 0 0-.337-2.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5zM5.145 12q.208.58.468 1.068c.552 1.035 1.218 1.65 1.887 1.855V12zm.182 2.472a7 7 0 0 1-.597-.933A9.3 9.3 0 0 1 4.09 12H2.255a7 7 0 0 0 3.072 2.472M3.82 11a13.7 13.7 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5zm6.853 3.472A7 7 0 0 0 13.745 12H11.91a9.3 9.3 0 0 1-.64 1.539 7 7 0 0 1-.597.933M8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855q.26-.487.468-1.068zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.7 13.7 0 0 1-.312 2.5m2.802-3.5a7 7 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7 7 0 0 0-3.072-2.472c.218.284.418.598.597.933M10.855 4a8 8 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4z"/>
                    </svg>
                    ${(url.match(`\/\/(.*?)(?:\/|$)`))[1]}
                </button>
            `
}

const viewSettingsVersion = Object.freeze({
    VersionIntroduced : 1,
    PlayDataIntroduced : 2
})

function tryLoadViewSettings() {
    let stored = localStorage.getItem("viewSettings")
    if (stored != null) {
        viewSettings = JSON.parse(stored)
    }

    if (viewSettings.tileSize === undefined) {
        viewSettings.tileSize = 200
    }

    if (viewSettings.tileDisplay === undefined) {
        viewSettings.tileDisplay = "crop"
    }

    if (viewSettings.version === undefined) {
        viewSettings.version = viewSettingsVersion.VersionIntroduced
    }
    
    if (viewSettings.version < viewSettingsVersion.PlayDataIntroduced) {
        if (!viewSettings.showfields.includes("playdata")) {
            viewSettings.showfields.push("playdata")
        }

        viewSettings.version = viewSettingsVersion.PlayDataIntroduced
    }

    applyTileDisplaySetting()
    
    let tileSizeInput = document.querySelector("#tileSizeInput")
    tileSizeInput.value = viewSettings.tileSize
    setTileSize(tileSizeInput)
}

function saveViewSettings() {
    localStorage.setItem("viewSettings", JSON.stringify(viewSettings))
}

function cancelViewSettings() {
    tryLoadViewSettings()

    document.querySelector('#groupby').value = viewSettings.groupBy
    document.querySelector("#sortby").value = viewSettings.sortBy
    document.querySelector("#displaytilesas").value = viewSettings.tileDisplay

    let sortDirButton = document.querySelector("#sortdirectionbtn")
    let isAsc = viewSettings.sortDir == "asc"
    sortDirButton.setAttribute("value", isAsc ? "asc" : "desc")
    setElementVisibility(sortDirButton.querySelector("#ascendingicon"), isAsc)
    setElementVisibility(sortDirButton.querySelector("#descendingicon"), !isAsc)

    for (let checkbox of document.querySelector("#showfields").getElementsByTagName("input")) {
        checkbox.checked = viewSettings.showfields.indexOf(checkbox.getAttribute("showfield")) != -1
    }
}
document.getElementById("cancelViewSettings").addEventListener("click", cancelViewSettings)

function applyTileDisplaySetting() {
    if (viewSettings.tileDisplay == "crop") {
        document.documentElement.style.setProperty("--gametile-aspect", `1`)
    }
    else {
        document.documentElement.style.setProperty("--gametile-aspect", `260/350`)
    }
}

function applyViewSettings() {
    // check for group by released
    viewSettings.groupBy = document.querySelector('#groupby').value
    viewSettings.sortBy = document.querySelector('#sortby').value
    viewSettings.sortDir = document.querySelector("#sortdirectionbtn").getAttribute("value")
    viewSettings.tileDisplay = document.querySelector("#displaytilesas").value

    viewSettings.showfields = []
    //get showfields
    for (let checkbox of document.querySelector("#showfields").getElementsByTagName("input")) {
        if (checkbox.checked)
            viewSettings.showfields.push(checkbox.getAttribute("showfield"))
    }

    if (coverMap.size > 0 && coverMap.values().next().value.includes("t_cover_big_2x") != viewSettings.tileSize > 250) {
        coverMap.clear()
    }

    applyTileDisplaySetting()
    saveViewSettings()
    refreshPlaylist()
}
document.getElementById("applyViewSettings").addEventListener("click", applyViewSettings)

async function doViewSettings() {
    let sortMethod = sortMethods.find(e => e.name == viewSettings.sortBy)
    if (sortMethod)
        await sortMethod.sort()

    let groupMethod = groupMethods.find(e => e.name == viewSettings.groupBy)
    if (groupMethod)
        await groupMethod.group()
}

function toggleSortDirection() {
    let sortDirButton = document.querySelector("#sortdirectionbtn")
    let isAsc = sortDirButton.getAttribute("value") == "asc"
    sortDirButton.setAttribute("value", isAsc ? "desc" : "asc")
    setElementVisibility(sortDirButton.querySelector("#ascendingicon"), !isAsc)
    setElementVisibility(sortDirButton.querySelector("#descendingicon"), isAsc)
}
document.getElementById("sortdirectionbtn").addEventListener("click", toggleSortDirection)

function resetViewGameModal() {
    let modal = document.querySelector("#viewGameModal")
    modal.querySelector(".modal-title").textContent = "View Game"
    modal.querySelector("#view-video-container").textContent = ""
    modal.querySelector('#releasedate').textContent = ""
    modal.querySelector('#platforms').textContent = ""
    modal.querySelector('#howlongtobeat').setAttribute("href", "")
    modal.querySelector('#description').textContent = ""
    modal.querySelector('#websites').textContent = ""
    modal.querySelector('#hltbMain').textContent = ""
    modal.querySelector('#hltbMainExtra').textContent = ""
    modal.querySelector('#hltbCompletionist').textContent = ""
    modal.querySelector("#franchisecard").textContent = ""
    setElementVisibility(modal.querySelector("#franchisecard"), false)
    modal.querySelector("#viewOnIGDB").setAttribute("href", "")
    modal.querySelector("#steamapplink").setAttribute("href", "")
    modal.querySelector("#steamapplink").innerHTML = ""
    for (let extensiontype in ViewModalExtensionType) {
        modal.querySelector(`#viewModalExtensionContainer-${ViewModalExtensionType[extensiontype]}`).textContent = ""
    }
}

function viewAddRemoveButtonClicked(ev) {
    let button = ev.srcElement
    let id = Number(button.getAttribute("gameId"))
    let title = button.getAttribute("gameTitle")
    if (button.getAttribute("id") == "viewaddbutton") {
        addGame(id, title)
        setElementVisibility(button.parentElement.querySelector('#viewremovebutton'), true)
        setElementVisibility(button, false)
    } else {
        removeGame(id, title)
        setElementVisibility(button.parentElement.querySelector('#viewaddbutton'), true)
        setElementVisibility(button, false)
    }
}
document.getElementById("viewaddbutton").addEventListener("click", viewAddRemoveButtonClicked)
document.getElementById("viewremovebutton").addEventListener("click", viewAddRemoveButtonClicked)

function onNotesInput() {
    let notesControlEl = document.getElementById("notesControls")
    setElementVisibility(notesControlEl, true)
}

async function viewCancelNoteButtonClicked(ev) {
    let button = ev.srcElement
    let id = Number(button.getAttribute("gameId"))
    let note = document.querySelector("#notes")

    note.value = await GetNote(id)

    let notesControlEl = document.getElementById("notesControls")
    setElementVisibility(notesControlEl, false)
}
document.getElementById("cancelNote").addEventListener("click", viewCancelNoteButtonClicked)

function viewSaveNoteButtonClicked(ev) {
    let button = ev.srcElement
    let id = Number(button.getAttribute("gameId"))
    let note = document.querySelector("#notes")

    SetNote(id, note.value)

    let notesControlEl = document.getElementById("notesControls")
    setElementVisibility(notesControlEl, false)
}
document.getElementById("saveNote").addEventListener("click", viewSaveNoteButtonClicked)

async function populateViewGameModal(ev) {
    let viewButton = ev.srcElement
    let gameTile = viewButton.closest(".gametile")
    let titleText = gameTile.querySelector(".gametitle").textContent
    let id = Number(gameTile.getAttribute("gameid"))
    populateViewGameModalWithGame(id, titleText)
}

async function populateViewGameModalWithGame(id, titleText) {
    let modal = document.querySelector("#viewGameModal")
    modal.setAttribute("gameId", id)
    resetViewGameModal()
    await (new bootstrap.Modal("#viewGameModal")).show()

    let title = modal.querySelector(".modal-title")
    title.textContent = titleText

    let addButton = modal.querySelector('#viewaddbutton')
    let removeButton = modal.querySelector('#viewremovebutton')
    let saveNoteButton = modal.querySelector('#saveNote')
    let resetNoteButton = modal.querySelector('#cancelNote')
    addButton.setAttribute("gameId", id)
    removeButton.setAttribute("gameId", id)
    saveNoteButton.setAttribute("gameId", id)
    resetNoteButton.setAttribute("gameId", id)
    addButton.setAttribute("gameTitle", title.textContent)
    removeButton.setAttribute("gameTitle", title.textContent)
    setElementVisibility(addButton, registeredPlaylistIds.indexOf(id) == -1)
    setElementVisibility(removeButton, registeredPlaylistIds.indexOf(id) != -1)

    viewCancelNoteButtonClicked({srcElement:resetNoteButton})

    let hltb = preloadHowLongToBeat([id])
    await preloadGameFields([id], ['name', 'summary', 'videos', 'first_release_date', 'platforms', 'franchises', 'url'], game => {
        if (!('first_release_date' in game))
            game['first_release_date'] = "TBA"
        else
            game['first_release_date'] *= 1000
        return game
    })
    
    let gameInfo = gameFieldsMap.get(id)
    if (gameInfo) {
        if (gameInfo.name)
            title.textContent = gameInfo.name
        if (gameInfo.url)
            modal.querySelector("#viewOnIGDB").setAttribute("href", gameInfo.url)
    }


    let videos = await preloadVideos()

    let videoContainer = modal.querySelector("#view-video-container")
    videoContainer.textContent = ""

    let carousel = videoContainer.appendChild(document.createElement("div"))
    carousel.setAttribute("id", "viewVideoCarousel")
    carousel.setAttribute("class", "carousel slide")
    
    carousel.addEventListener('slide.bs.carousel', () => {
        let c = document.getElementById("viewVideoCarousel")
        let v = c.querySelector(".carousel-item.active iframe")
        v.setAttribute("src", v.getAttribute("src"))
    })

    let carouselIndicators = carousel.appendChild(document.createElement("div"))
    carouselIndicators.setAttribute("class", "carousel-indicators")
    
    let carouselInner = carousel.appendChild(document.createElement("div"))
    carouselInner.setAttribute("class", "carousel-inner")

    //gameInfo = gameFieldsMap.get(id)
    if (gameInfo.videos) {
        for (let videoid of gameInfo.videos) {
            let video = videos.get(videoid)
            let indicator = carouselIndicators.appendChild(document.createElement("button"))
            indicator.setAttribute("type", "button")
            indicator.setAttribute("data-bs-target", "#viewVideoCarousel")
            indicator.setAttribute("data-bs-slide-to", carouselIndicators.childElementCount - 1)
            if (carouselIndicators.childElementCount == 1) {
                indicator.setAttribute("class", "active")
                indicator.setAttribute("aria-current", "true")
            }
            
            let carouselitem = carouselInner.appendChild(document.createElement("div"))
            if (carouselInner.childElementCount == 1)
                carouselitem.setAttribute("class", "carousel-item active")
            else
            carouselitem.setAttribute("class", "carousel-item")
        
            let frame = carouselitem.appendChild(document.createElement("iframe"))
            frame.setAttribute("class", `gamevideo rounded-5`)
            frame.setAttribute("src", `https://www.youtube.com/embed/${video}`)
        }

        carousel.innerHTML += `
            <button class="carousel-control-prev" type="button" data-bs-target="#viewVideoCarousel" data-bs-slide="prev">
                <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Previous</span>
            </button>
            <button class="carousel-control-next" type="button" data-bs-target="#viewVideoCarousel" data-bs-slide="next">
                <span class="carousel-control-next-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Next</span>
            </button>
        `
    }

    if (gameInfo.summary) {
        modal.querySelector('#description').textContent = gameInfo.summary
    }
    
    if (gameInfo.first_release_date) {
        let releaseDate = modal.querySelector('#releasedate')
        if (gameInfo.first_release_date == 'TBA') {
            releaseDate.textContent = gameInfo.first_release_date
        }
        else {
            releaseDate.innerHTML = new Date(gameInfo.first_release_date).toDateString()
            releaseDate.innerHTML += `<br>${dateToRelativeString(new Date(gameInfo.first_release_date))}`
        }
    }

    await preloadPrice(id)
    let priceCardEl = document.getElementById("pricecard")
    if (gameInfo.price && gameInfo.price.final_formatted != undefined) {
        let priceEl = document.getElementById("price")
        priceEl.innerHTML = `<strike>${gameInfo.price.initial_formatted}</strike> ${gameInfo.price.final_formatted}`
        setElementVisibility(priceCardEl, true)
    }
    else {
        setElementVisibility(priceCardEl, false)
    }

    let platformMetaInfo = await preloadPlatformMetaInfo()
    if (gameInfo.platforms) {
        let platforms = modal.querySelector('#platforms')
        let ul = platforms.appendChild(document.createElement("ul"))
        ul.setAttribute("class", "list-group")

        let ps = []
        for (let platformId of gameInfo.platforms) {
            let meta = platformMetaInfo.get(platformId)
            ps.push({
                slug: meta.slug,
                icon: await getPlatformIcon(meta.slug),
                name: meta.name
            })
        }

        ps.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase())
        for (let p of ps) {
            let li = document.createElement("li")
            li.setAttribute("class", "list-group-item")
            li.innerHTML = `${p.icon} ${p.name}`
            li.addEventListener("click", () => spreadsheetGen(id, p.slug))
            ul.appendChild(li)
        }
    }

    await preloadWebsites([id])
    gameInfo = gameFieldsMap.get(id)
    if (gameInfo.websites) {
        let websites = modal.querySelector('#websites')

        for (let website of gameInfo.websites) {
            let linkContent = getLinkButton(website.url)
            
            websites.innerHTML += `<a href="${website.url}" target="_blank">${linkContent}</a>`

            if (website.url.match(/\/\/(.*?)(?:\/|$)/)[1] == "store.steampowered.com") {
                let steamAppId = website.url.match(/app\/(\d+)/)[1]
                let steamAppLink = document.getElementById("steamapplink")
                let url = `steam://advertise/${steamAppId}`
                linkContent = getLinkButton(url)
                steamAppLink.innerHTML = `<a href="${url}" target="_blank">${linkContent}</a>`
            }
        }

        let children = [...websites.children].sort((a, b) => a.textContent.trim() > b.textContent.trim())
        for (let c of children)
            websites.appendChild(c)
    }

    if (gameInfo.franchises) {
        let franchises = await loadFranchise(gameInfo.franchises)
        let gameIds = franchises.map(f => f.games).reduce((t, c)=>t.concat(c))
        await preloadGameFields(gameIds, ['name'],e=>e , [0])
        preloadCovers(gameIds.reduce((t,c) => {
            if (t.Games)
                t.Games.push({id:c})
            else
                t = {Games:[{id:c}]}
            return t
        }))
        let franchiseCard = modal.querySelector("#franchisecard")
        setElementVisibility(franchiseCard, true)
        for (let franchise of franchises) {
            franchiseCard.appendChild(document.createElement("h5")).textContent = `Other ${franchise.name} Games`
            let div = franchiseCard.appendChild(document.createElement("div"))
            div.setAttribute("class", "d-flex flex-nowrap overflow-auto")

            for (let gid of franchise.games) {
                if (gameFieldsMap.has(gid)) {
                    let g = new GameInfo(gid, gameFieldsMap.get(gid).name, Date.now())
                    div.appendChild(g.createTile(true))
                }
            }
        }
    }

    // Add view extensions
    await applyViewModalExtensions(id, modal)

    hltb = (await hltb).get(id)
    if (hltb) {
        let formatter = new Intl.DurationFormat("en", {style: "narrow"})
        let format = (h => h == 0 ? "-" : formatter.format({hours:Math.round(h)}))

        modal.querySelector('#howlongtobeat').setAttribute("href", hltb.url)
        modal.querySelector('#hltbMain').textContent = format(hltb.main)
        modal.querySelector('#hltbMainExtra').textContent = format(hltb.main_extra)
        modal.querySelector('#hltbCompletionist').textContent = format(hltb.completionist)
    }
}

async function spreadsheetGen(gameId, platformSlug) {
    let gameInfo = gameFieldsMap.get(gameId)

    const spreadsheetPlatformMap = new Map([
        ['android', 'Android'],
        ['3ds', 'Nintendo 3DS'],
        ['n64', 'Nintendo 64'],
        ['nds', 'Nintendo DS'],
        ['nintendo-dsi', 'Nintendo DS'],
        ['gb', 'Nintendo Gameboy'],
        ['gba', 'Nintendo Gameboy Advance'],
        ['gbc', 'Nintendo Gameboy Color'],
        ['gamecube', 'Nintendo Gamecube'],
        ['nes', 'Nintendo NES'],
        ['snes', 'Nintendo SNES'],
        ['switch', 'Nintendo Switch'],
        ['switch-2', 'Nintendo Switch 2'],
        ['virtual-boy', 'Nintendo Virtual Boy'],
        ['wii', 'Nintendo Wii'],
        ['wiiu', 'Nintendo Wii U'],
        ['oculus-quest', 'Meta Quest Store'],
        ['oculus-rift', 'Meta Quest Store'],
        ['oculus-vr', 'Meta Quest Store'],
        ['meta-quest-2', 'Meta Quest Store'],
        ['meta-quest-3', 'Meta Quest Store'],
        ['steam-vr', 'PC - Steam'],
        ['win', 'PC - Steam'],
        ['ps', 'PlayStation'],
        ['ps2', 'PlayStation 2'],
        ['ps3', 'PlayStation 3'],
        ['ps4--1', 'PlayStation 4'],
        ['ps5', 'PlayStation 5'],
        ['psp', 'PlayStation Portable'],
        ['psvita', 'PlayStation Vita'],
        ['32x', 'Sega 32X'],
        ['sega-cd', 'Sega CD'],
        ['dc', 'Sega Dreamcast'],
        ['gamegear', 'Sega GameGear'],
        ['genesis', 'Sega Genesis'],
        ['master-system', 'Sega Master System'],
        ['saturn', 'Sega Saturn'],
        ['xbox', 'Xbox'],
        ['xbox360', 'Xbox 360'],
        ['xboxone', 'Xbox One'],
        ['series-x-s', 'Xbox Series'],
    ])

    let platform = platformSlug
    if (spreadsheetPlatformMap.has(platform)) platform = spreadsheetPlatformMap.get(platform)

    const shortDateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'short' })
    let release = new Date(gameInfo.first_release_date)
    release = shortDateFormat.format(release)

    let today = new Date(Date.now())
    today = shortDateFormat.format(today)
    
    let spreadsheetString = `${today}\t\t\t${gameInfo.name}\t${release}\t\t${platform}\tNo\tNo\tNo`
    navigator.clipboard.writeText(spreadsheetString)
}

function saveClientSettings() {
    let serverAddr = document.querySelector("#serverAddressInput").value
    let userName = document.querySelector("#userDisplayNameInput").value
    let playlistName = document.querySelector("#playlistNameInput").value

    localStorage.setItem("playlistServerAddress", serverAddr)
    localStorage.setItem("userDisplayName", userName)
    localStorage.setItem("playlistName", playlistName)

    let prevPlaylists = JSON.parse(localStorage.getItem("previouslyUsedPlaylists"))
    if (prevPlaylists == null) {
        prevPlaylists = []
    }
    prevPlaylists = prevPlaylists.filter(e => e != config.playlistName)
    prevPlaylists.unshift(config.playlistName)
    while (prevPlaylists.length > 5)
        prevPlaylists.pop()
    localStorage.setItem("previouslyUsedPlaylists", JSON.stringify(prevPlaylists))

    let prevServers = JSON.parse(localStorage.getItem("previouslyUsedServers"))
    if (prevServers == null) {
        prevServers = []
    }
    prevServers = prevServers.filter(e => e != config.serveraddress)
    prevServers.unshift(config.serveraddress)
    while (prevServers.length > 5)
        prevServers.pop()
    localStorage.setItem("previouslyUsedServers", JSON.stringify(prevServers))

    loadConfigFromLocalStorage()

    refreshPlaylist()
}
document.getElementById("saveClientSettings").addEventListener("click", saveClientSettings)

function loadConfigFromLocalStorage() {
    let serverAddr = localStorage.getItem("playlistServerAddress")
    if (serverAddr != null) {
        config.serveraddress = serverAddr
    }
    else {
        config.serveraddress = ""
    }
    
    let userName = localStorage.getItem("userDisplayName")
    if (userName != null) {
        config.userName = userName
    }
    else {
        config.userName = ""
    }
    
    let playlistName = localStorage.getItem("playlistName")
    if (playlistName != null) {
        config.playlistName = playlistName
    }
    else {
        config.playlistName = ""
    }

    let prevServers = JSON.parse(localStorage.getItem("previouslyUsedServers"))
    if (prevServers == null) {
        prevServers = []
    }

    let prevPlaylists = JSON.parse(localStorage.getItem("previouslyUsedPlaylists"))
    if (prevPlaylists == null) {
        prevPlaylists = []
    }

    document.querySelector("#serverAddressInput").value = config.serveraddress
    document.querySelector("#userDisplayNameInput").value = config.userName
    document.querySelector("#playlistNameInput").value = config.playlistName

    let prevServersDropdown = document.querySelector("#previousServersDropdown")
    prevServersDropdown.innerHTML = ""

    prevServers.forEach(e => {
        let a = document.createElement("a")
        a.setAttribute("class", "dropdown-item")
        a.innerHTML = `${e}`
        a.addEventListener("click", ev => prevServerClicked(ev.srcElement))

        let li = document.createElement("li")
        li.appendChild(a)
        prevServersDropdown.appendChild(li)
    })

    let prevPlaylistsDropdown = document.querySelector("#previousPlaylistsDropdown")
    prevPlaylistsDropdown.innerHTML = ""

    prevPlaylists.forEach(e => {
        let a = document.createElement("a")
        a.setAttribute("class", "dropdown-item")
        a.innerHTML = `${e}`
        a.addEventListener("click", ev => prevPlaylistClicked(ev.srcElement))

        let li = document.createElement("li")
        li.appendChild(a)
        prevPlaylistsDropdown.appendChild(li)
    })

    return (serverAddr != null) && (userName != null) && (playlistName != null)
}

function prevServerClicked(item) {
    document.querySelector("#serverAddressInput").value = item.textContent
}

function prevPlaylistClicked(item) {
    document.querySelector("#playlistNameInput").value = item.textContent
}

function copyViewGameLink() {
    let modal = document.querySelector("#viewGameModal")
    let gameId = modal.getAttribute("gameId")

    let string = window.location.origin + window.location.pathname + `?showGame=${gameId}`
    navigator.clipboard.writeText(string)
}
document.getElementById("copyViewGameLink").addEventListener("click", copyViewGameLink)

async function screenshotPlaylist() {
    let loadingModal = (new bootstrap.Modal("#loadingModal"))
    loadingModal.show()

    let container = document.querySelector("#gametilecontainer")
    let columns = Math.trunc(Math.sqrt(container.children.length))
    if (viewSettings.tileDisplay == "full") {
        columns = Math.trunc(columns * (350/260))
    }

    container.setAttribute("style", `max-width:${Math.max(500, columns * ((Number(viewSettings.tileSize) + 16)))}px !important; width:${Math.max(500, columns * ((Number(viewSettings.tileSize) + 16)))}px !important`)
    let dataUrl = await domtoimage.toPng(container, {bgcolor:"#212529"})
    
    const now = new Date()
    let link = document.createElement('a')
    link.download = `Playlist-${config.playlistName}-${now.getMonth()}-${now.getDay()}-${now.getFullYear()}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}.png`
    link.href = dataUrl
    link.click()

    container.setAttribute("style", "")

    loadingModal.hide()
}
document.getElementById("screenshotPlaylist").addEventListener("click", screenshotPlaylist)

function viewRandomGame() {
    let gametilecontainer = document.getElementById("gametilecontainer")
    let gameTiles = [...gametilecontainer.getElementsByClassName("gametile")]

    gameTiles = gameTiles.filter(e => e.getAttribute("addedBy") != " Current" && e.getAttribute("addedBy") != "~Past Games~")

    let index = Math.floor(Math.random() * gameTiles.length)
    let gameTile = gameTiles[index]
    let titleText = gameTile.querySelector(".gametitle").textContent
    let id = Number(gameTile.getAttribute("gameid"))
    populateViewGameModalWithGame(id, titleText)
}
document.getElementById("viewRandomGame").addEventListener("click", viewRandomGame)
