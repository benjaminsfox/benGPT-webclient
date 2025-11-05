async function sortAlphabetically(gameTiles) {
    gameTiles.sort((a, b) => {
        let atitle = a.querySelector(".gametitle").textContent
        let btitle = b.querySelector(".gametitle").textContent
        return atitle < btitle
    })
}

registerSortMethod("alpha", "Alphabetical", sortAlphabetically)

async function sortByReleased(gameTiles) {
    await preloadReleaseInfo()
    gameTiles.sort((a, b) => {
        let arelease = gameFieldsMap.get(Number(a.getAttribute("gameid"))).first_release_date
        let brelease = gameFieldsMap.get(Number(b.getAttribute("gameid"))).first_release_date
        return arelease < brelease || brelease == 'TBA'
    })
}

registerSortMethod("released", "Released", sortByReleased)

function sortByHltb(field) {
    return async function(gameTiles) {
        let hltbinfo = await preloadHowLongToBeat()
        gameTiles.sort((a, b) => {
            let aTime = hltbinfo.get(Number(a.getAttribute("gameid")))[field]
            let bTime = hltbinfo.get(Number(b.getAttribute("gameid")))[field]
            if (aTime == 0) aTime = Number.POSITIVE_INFINITY
            if (bTime == 0) bTime = Number.POSITIVE_INFINITY
            return aTime < bTime;
        })
    }
}

registerSortMethod("hltbMain", "How Long To Beat (Main)", sortByHltb('main'))
registerSortMethod("hltbMainExtra", "How Long To Beat (Main + Extra)", sortByHltb('main_extra'))
registerSortMethod("hltbCompletionist", "How Long To Beat (Completionist)", sortByHltb('completionist'))

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

    categories.sort((a, b) => a.displayName.toLowerCase() < b.displayName.toLowerCase()).reverse()

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

    categories.sort((a, b) => a.displayName.toLowerCase() < b.displayName.toLowerCase()).reverse()

    return categories
}

registerGroupMethod("addedBy", "Added By User", groupByAddedBy)

async function addAddedByUserToTile(tile) {
    let name = tile.getAttribute("addedBy")
    let title = tile.querySelector('.gametitle')
    
    let user = document.createElement("div")
    user.setAttribute("class", `text-center text-truncate px-2`)
    
    user.textContent = `Added by ${name}`

    title.after(user)
}

registerGameTileVisual("addedBy", "Added By User", addAddedByUserToTile)

async function addReleaseDateToTile(tile) {
    await preloadReleaseInfo()
    
    let id = Number(tile.getAttribute("gameid"))
    let title = tile.querySelector('.gametitle')
    
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

    title.after(date)
}

registerGameTileVisual("releasedate", "Release Date", addReleaseDateToTile)

async function addPlatformIconsToTile(tile) {
    await preloadPlatformInfo()
    let platformmetainfo = await preloadPlatformMetaInfo()
    let id = Number(tile.getAttribute("gameid"))

    let div = document.createElement("div")
    div.setAttribute("class", "d-flex justify-content-center")
    
    for (platformid of gameFieldsMap.get(id).platforms) {
        let thisdiv = div.appendChild(document.createElement("div"))
        thisdiv.setAttribute("class", "mx-1")
        thisdiv.setAttribute("title", platformmetainfo.get(platformid).name)
        thisdiv.innerHTML += await getPlatformIcon(platformmetainfo.get(platformid).slug)
    }

    let children = [...div.children]
    children.sort((a, b) => a.getAttribute("title").toLowerCase() < b.getAttribute("title").toLowerCase()).reverse()
    children.forEach(e => div.appendChild(e))

    tile.querySelector(".gametitle").after(div)
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

        tile.querySelector(".gametitle").after(div)
    }
}

registerGameTileVisual("hltb", "Beat Time", addTimeToBeatToTile)
