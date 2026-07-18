
// Sort Methods
async function sortAlphabetically(gameTiles) {
    gameTiles.sort((a, b) => {
        let atitle = a.querySelector(".gametitle").textContent
        let btitle = b.querySelector(".gametitle").textContent
        if (atitle > btitle) return -1;
        if (atitle < btitle) return 1;
        return 0
    })
}

registerSortMethod("alpha", "Alphabetical", sortAlphabetically)

async function sortByReleased(gameTiles) {
    await preloadReleaseInfo()
    gameTiles.sort((a, b) => {
        let arelease = gameFieldsMap.get(Number(a.getAttribute("gameid"))).first_release_date
        let brelease = gameFieldsMap.get(Number(b.getAttribute("gameid"))).first_release_date
        if (brelease == 'TBA') return 1;
        if (arelease == 'TBA') return -1;
        if (arelease < brelease) return 1;
        if (arelease > brelease) return -1;
        return 0;
    })
}

registerSortMethod("released", "Released", sortByReleased)

function sortByHltb(field) {
    return async function(gameTiles) {
        let hltbinfo = await preloadHowLongToBeat()
        gameTiles.sort((a, b) => {
            let aTime = hltbinfo.get(Number(a.getAttribute("gameid")))
            let bTime = hltbinfo.get(Number(b.getAttribute("gameid")))
            aTime = aTime ? aTime[field] : 0;
            bTime = bTime ? bTime[field] : 0;
            if (aTime == 0) aTime = Number.POSITIVE_INFINITY
            if (bTime == 0) bTime = Number.POSITIVE_INFINITY
            if (aTime > bTime) return -1;
            if (aTime < bTime) return 1;
            return 0;
        })
    }
}

registerSortMethod("hltbMain", "How Long To Beat (Main)", sortByHltb('main'))
registerSortMethod("hltbMainExtra", "How Long To Beat (Main + Extra)", sortByHltb('main_extra'))
registerSortMethod("hltbCompletionist", "How Long To Beat (Completionist)", sortByHltb('completionist'))

// Group Methods

async function groupByReleased(gameTiles) {
    await preloadReleaseInfo()
    
    let releasedCategory = GroupMethod.Category("Released")
    let comingSoonCategory = GroupMethod.Category("Coming Soon")

    for (gameTile of gameTiles) {
        let releasedate = gameFieldsMap.get(Number(gameTile.getAttribute("gameId"))).first_release_date
        if (releasedate) {
            if (releasedate == 'TBA') {
                comingSoonCategory.push(gameTile)
            } else {
                let rdate = new Date(releasedate)
                if (rdate > Date.now()) {
                    comingSoonCategory.push(gameTile)
                } else {
                    releasedCategory.push(gameTile)
                }
            }
        }
    }

    return [releasedCategory, comingSoonCategory]
}

registerGroupMethod("released", "Released", groupByReleased)

async function groupByPlatform(gameTiles) {
    await preloadPlatformInfo()
    let platformMetaInfo = await preloadPlatformMetaInfo()
    
    let categories = []

    for (gameTile of gameTiles) {
        let platforms = gameFieldsMap.get(Number(gameTile.getAttribute("gameId"))).platforms
        for (plat of platforms) {
            let category = categories.find(e => e.displayName == platformMetaInfo.get(plat).name)
            if (!category) {
                category = GroupMethod.Category(platformMetaInfo.get(plat).name)
                categories.push(category)
            }

            category.push(gameTile.cloneNode(true))
        }
        gameTile.remove()
    }

    categories.sort()

    return categories
}

registerGroupMethod("platform", "Platform", groupByPlatform)

async function groupByAddedBy(gameTiles) {
    let categories = []

    for (gameTile of gameTiles) {
        let addedBy = gameTile.getAttribute("addedBy")
        let category = categories.find(e => e.displayName == addedBy)
        if (!category) {
            category = GroupMethod.Category(addedBy)
            categories.push(category)
        }

        category.push(gameTile)
    }

    categories.sort()

    return categories
}

registerGroupMethod("addedBy", "Added By User", groupByAddedBy)

// Game Tile Visuals

async function addAddedByUserToTile(tile) {
    let name = tile.getAttribute("addedBy")
    let visuals = tile.querySelector("#gameTileVisuals");
    
    let user = document.createElement("div")
    user.setAttribute("class", `text-center text-truncate px-2`)
    
    user.textContent = `Added by ${name}`

    visuals.appendChild(user)
}

registerGameTileVisual("addedBy", "Added By User", addAddedByUserToTile)

async function addReleaseDateToTile(tile) {
    await preloadReleaseInfo()
    
    let id = Number(tile.getAttribute("gameid"))
    let visuals = tile.querySelector("#gameTileVisuals");
    
    let date = document.createElement("div")
    date.setAttribute("class", `gamedate text-center text-truncate px-2`)
    
    let releasedate = gameFieldsMap.get(id).first_release_date
    if (releasedate) {
        if (releasedate == 'TBA') {
            date.textContent = releasedate
        } else {
            let rdate = new Date(releasedate)
            date.innerHTML = `${rdate.toLocaleDateString()}<br>${dateToRelativeString(rdate)}`
        }
    }

    visuals.appendChild(date)
}

registerGameTileVisual("releasedate", "Release Date", addReleaseDateToTile)

async function addPlatformIconsToTile(tile) {
    await preloadPlatformInfo()
    let platformmetainfo = await preloadPlatformMetaInfo()
    let id = Number(tile.getAttribute("gameid"))

    let div = document.createElement("div")
    div.setAttribute("class", "d-flex justify-content-center")
    
    game = gameFieldsMap.get(id)

    if (!game.platforms)
        return

    for (platformid of game.platforms) {
        let thisdiv = div.appendChild(document.createElement("div"))
        thisdiv.setAttribute("class", "mx-1")
        thisdiv.setAttribute("title", platformmetainfo.get(platformid).name)
        thisdiv.innerHTML += await getPlatformIcon(platformmetainfo.get(platformid).slug)
    }

    let children = [...div.children]
    children.sort((a, b) => a.getAttribute("title").toLowerCase() < b.getAttribute("title").toLowerCase()).reverse()
    children.forEach(e => div.appendChild(e))

    let visuals = tile.querySelector("#gameTileVisuals");
    visuals.appendChild(div)
}

registerGameTileVisual("platform", "Platforms", addPlatformIconsToTile, true, true)

async function addTimeToBeatToTile(tile) {
    let hltbinfo = await preloadHowLongToBeat()
    let id = Number(tile.getAttribute("gameid"))

    let formatter = new Intl.DurationFormat("en", {style: "narrow"})
    let format = (h => h == 0 ? "-" : formatter.format({hours:Math.round(h)}))

    let hltb = hltbinfo.get(id)
    if (hltb) {
        let div = document.createElement("a")
        div.setAttribute("class", "btn-group")
        div.setAttribute("target", "_blank")
        div.setAttribute("href", hltb.url)
        div.setAttribute("style", "width:100%")
    
        let button = div.appendChild(document.createElement("button"))
        button.setAttribute("class", "btn btn-sm btn-success")
        button.textContent = format(hltb.main)
        button = div.appendChild(document.createElement("button"))
        button.setAttribute("class", "btn btn-sm btn-primary")
        button.textContent = format(hltb.main_extra)
        button = div.appendChild(document.createElement("button"))
        button.setAttribute("class", "btn btn-sm btn-danger")
        button.textContent = format(hltb.completionist)

        let visuals = tile.querySelector("#gameTileVisuals");
        visuals.appendChild(div)
    }
}

registerGameTileVisual("hltb", "Beat Time", addTimeToBeatToTile)

async function addPlayDataToTile(tile) {
    let playdata = await preloadPlayData()
    let id = Number(tile.getAttribute("gameid"))

    let data = playdata.get(id)

    let played = data ? data.includes(config.userName) : false;

    // create the div to hold the play data button
    let div = document.createElement("div")
    div.setAttribute("class", "rounded")
    div.setAttribute("title", "Click to toggle whether you've played this game or not")
    div.setAttribute("id", "playdata")
    div.setAttribute("style", "text-align: right")

    let button = div.appendChild(document.createElement("button"))
    button.setAttribute("class", `btn btn-sm ${played ? 'btn-success' : 'btn-secondary'}`)
    button.innerHTML = played ? `Played: &#128505;` : `Played: &#9744;`

    button.addEventListener("click", async (event) => {
        let body = {
            "op" : "setPlayData",
            "id" : id,
            "user" : config.userName,
            "played" : !played
        }

        await postServer(body)
        let response = await postServer(body)
        if (response.ok) {
            resetPlayData();

            tile = event.target.closest(".gametile")
            tile.querySelector("#playdata").outerHTML = ''
            await addPlayDataToTile(tile)
        }
    })

    let visuals = tile.querySelector(".gamecontrolcontent");
    visuals.appendChild(div)
}

registerGameTileVisual("playdata", "Play Data", addPlayDataToTile, true, false)

// View Modal Extensions

async function addPlayDataToViewModal(carddiv, gameId, modalBody) {
    let playdata = await preloadPlayData()
    let data = playdata.get(gameId)

    let p = document.createElement("p")
    carddiv.appendChild(p)

    carddiv.querySelector("h5").innerHTML = data ? `Played by <b>${data.length}</b> User${data.length !== 1 ? 's' : ''}` : "Played by <b>0</b> Users"

    if (data && data.length > 0) {
        let ul = document.createElement("ul")
        carddiv.appendChild(ul)
        ul.setAttribute("class", "list-group")

        for (let user of data) {
            let li = document.createElement("li")
            li.setAttribute("class", "list-group-item")
            li.textContent = user
            ul.appendChild(li)
        }
    }
    
}

registerViewModalExtension("playdata", "Played By", addPlayDataToViewModal, ViewModalExtensionType.Sidebar)