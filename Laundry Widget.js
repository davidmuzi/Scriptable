// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: tint;

/*
 * Script setup
 * 
 * 1. Copy this script to the Scriptable folder in iCloud
 * 2. Obtain a Personal Access Token (PAT) at https://account.smartthings.com/tokens with the permissions: l:devices,r:devices:*
 * 3. Add a widget to your homescreen, choose Scriptable, and this script
 * 4. In the wiget configuration, paste the PAT in the Parameter field
 */

const devToken = undefined // paste the PAT here to run this script within the app

class SmartThingsAPI {
  constructor(apiKey) {
    this.apiKey = apiKey
  }

  async getDeviceStatus(id, key) {
    console.log("getting device status")
    const deviceStatusURL = `https://api.smartthings.com/v1/devices/${id}/status`

    const request = new Request(deviceStatusURL)
    request.headers = {Authorization: `Bearer ${this.apiKey}`}
    const json = await request.loadJSON()

    const completionDate = new Date(json.components.main[key].completionTime.value)
    const stopped = json.components.main[key].machineState.value === 'stop'

    return stopped ? -1 : completionDate
  }

  async fetchDevices() {
    console.log("fetching devices")
    const deviceStatusURL = `https://api.smartthings.com/v1/devices`
    
    const request = new Request(deviceStatusURL)
    request.headers = {Authorization: `Bearer ${this.apiKey}`}
    const json = await request.loadJSON()
    
    const devices = {}
    
    json.items.forEach(item => {
      if (item.ocf.ocfDeviceType === "oic.d.dryer") {
        console.log("found dryer")
        devices.dryer = item.deviceId
      } else if (item.ocf.ocfDeviceType === "oic.d.washer") {
        console.log("found washer")
        devices.washer = item.deviceId
      }
    })
  
    return devices
  }
}

// Globals
const token = args.widgetParameter ?? devToken
const smartthingsAPI = new SmartThingsAPI(token)

const local = FileManager.iCloud()
const path = local.joinPath(local.documentsDirectory(), "laundry_devices.json")

let widget = await deployWidget();
if (!config.runsInWidget) {
    widget.presentSmall();
}
Script.setWidget(widget);
Script.complete();

async function getStoredDevices() {
  if (local.fileExists(path)) {
    await local.downloadFileFromiCloud(path)
    const storedDevices = local.readString(path)

    return JSON.parse(storedDevices)
  }
  return undefined
}

function storeDevices(devices) {
  local.writeString(path, JSON.stringify(devices))
}

async function deployWidget() {
    let list = new ListWidget();
    list.setPadding(12, 12, 12, 12);
       
    // Check if devices are already configured
    let cachedDevices = await getStoredDevices()
    if (cachedDevices === undefined) {
        cachedDevices = await smartthingsAPI.fetchDevices()
        storeDevices(cachedDevices)
    }

    // Washer
    const washer = {
        symbol: "washer",
        title: "Washer",
        id: cachedDevices.washer,
        operation: "washerOperatingState",
        activeColor: Color.blue()
    }
    await deviceStack(washer, list)
 
    list.addText("")

    // Dryer
    const dryer = {
        symbol: "dryer",
        title: "Dryer",
        id: cachedDevices.dryer,
        operation: "dryerOperatingState",
        activeColor: Color.red()
    }
    await deviceStack(dryer, list)

    return list;
}

async function deviceStack(device, list) {
    const stack = list.addStack()
	  stack.layoutHorizontally()
    stack.spacing = 5
    const symbol = SFSymbol.named(device.symbol)
    
    const img = stack.addImage(symbol.image)
    img.imageSize = new Size(30, 30)

  	const title = stack.addText(device.title)
    title.font = Font.mediumSystemFont(20)

	  const completionDate = await smartthingsAPI.getDeviceStatus(device.id, device.operation)

    if (completionDate < 0) {
        list.addText(`Off`).font = Font.boldMonospacedSystemFont(24)
        img.tintColor = Color.gray()
    } 
    else {
      const date = list.addDate(completionDate)
      date.applyTimerStyle()
      date.font = Font.boldMonospacedSystemFont(24)
      img.tintColor = device.activeColor
    }
}
