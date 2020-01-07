import {ComelitClient, DeviceData, LightDeviceData, ThermostatDeviceData} from "./comelit-client";
import {Homebridge} from "./types";
import {Accessory, CharacteristicEventTypes} from "hap-nodejs";
import crypto, {BinaryLike} from "crypto";

require("@babel/polyfill");

const ROOT_ID = 'GEN#17#13#1';
const OFF = 0;
const HEAT = 1;
const COOL = 2;
const CELSIUS = 0;
const ON = 1;

/*
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BROKER_URL = 'mqtt://192.168.0.66';

async function run() {
    try {
        const client = new ComelitClient('paolofollia', 'viapaggipalazzinaB');
        await client.initClient(BROKER_URL, 'hsrv-user', 'sf1nE9bjPc');
        const loggedIn = await client.login();
        if (loggedIn) {
            const rootElementInfo = await client.device(ROOT_ID);
            const home = client.mapHome(rootElementInfo);
            const ids = [...home.lightsIndex.keys()];
            console.log(`Found ${ids.length}`);
            ids.forEach(id => console.log(`ID: ${id}, ${home.lightsIndex.get(id).descrizione}`));

            const LUCE = 'DOM#LT#5.6';
            const info = await client.device(LUCE);

            console.log(info);

        } else {
            console.log('Error logging in');
        }
    } catch (e) {
        // Do something about it!
        console.log(e.stack);
        process.exit();
    }
}

// run();
*/

export default function (homebridge: Homebridge) {
    // For platform plugin to be considered as dynamic platform plugin,
    // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
    homebridge.registerPlatform("homebridge-comelit-hub", "Comelit", ComelitPlatform, true);
}

export interface HubConfig {
    username: string;
    password: string;
    hub_username: string;
    hub_password: string;
    broker_url: string;
}

class ComelitPlatform {
    private readonly log: Function;
    private readonly api: Homebridge;
    private client: ComelitClient;
    private readonly config: HubConfig;
    private accessoriesList: ComelitAccessory<DeviceData>[] = [];

    constructor(log: Function, config: HubConfig, api: Homebridge) {
        this.log = (str: string) => log("[COMELIT HUB] " + str);
        this.log('Initialiazing platform: ', config);
        this.config = config;

        if (api) {
            // Save the API object as plugin needs to register new accessory via this object
            this.api = api;
        }

        this.log("homebridge API version: " + api.version);
    }

    async accessories(callback: Function) {
        this.client = new ComelitClient(this.config.username, this.config.password);
        await this.client.initClient(this.config.broker_url, this.config.hub_username, this.config.hub_password);
        const loggedIn = await this.client.login();
        if (loggedIn) {
            const rootElementInfo = await this.client.device(ROOT_ID);
            const homeIndex = this.client.mapHome(rootElementInfo);
            const lightIds = [...homeIndex.lightsIndex.keys()];
            this.log(`Found ${lightIds.length} lights`);
            lightIds.forEach(id => {
                const deviceData = homeIndex.lightsIndex.get(id);
                if (deviceData) {
                    const room = homeIndex.roomsIndex.get(deviceData.placeId).descrizione;
                    this.log(`Light ID: ${id}, ${deviceData.descrizione} - ${room}`);
                    this.accessoriesList.push(new ComelitLightAccessory(this.log, this.config, deviceData, room, this.client, this.api));
                }
            });
            const thermostatIds = [...homeIndex.lightsIndex.keys()];
            this.log(`Found ${thermostatIds.length} thermostats`);
            thermostatIds.forEach(id => {
                const deviceData = homeIndex.thermostatsIndex.get(id);
                if (deviceData) {
                    const room = homeIndex.roomsIndex.get(deviceData.placeId).descrizione;
                    this.log(`Thermostat ID: ${id}, ${deviceData.descrizione} - ${room}`);
                    this.accessoriesList.push(new ComelitThermostatAccessory(this.log, this.config, deviceData, room, this.client, this.api));
                }
            });
        } else {
            this.log('Error logging in');
        }
        callback(this.accessoriesList);
    }
}

function generateUUID(data: BinaryLike) {
    const sha1sum = crypto.createHash('sha1');
    sha1sum.update(data);
    const s = sha1sum.digest('hex');
    let i = -1;
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
        i += 1;
        switch (c) {
            case 'y':
                return ((parseInt('0x' + s[i], 16) & 0x3) | 0x8).toString(16);
            case 'x':
            default:
                return s[i];
        }
    });
}

class ComelitAccessory<T extends DeviceData> extends Accessory {
    name: string;
    log: Function;
    config: any;
    device: T;
    client: ComelitClient;
    currentStatus: number;
    room: string;
    reachable: boolean;
    homebridge: Homebridge;

    constructor(log: Function, config: HubConfig, device: T, room: string, client: ComelitClient, homebridge: Homebridge) {
        super(device.descrizione, generateUUID(device.id));
        this.config = config;
        this.log = (str: string) => log("[" + this.name + "] " + str);
        this.device = device;
        this.currentStatus = parseInt(this.device.status);
        this.client = client;
        this.name = this.device.descrizione;
        this.room = room;
        this.reachable = true;
        this.homebridge = homebridge;
        this.bridged = true;
    }

}

class ComelitLightAccessory extends ComelitAccessory<LightDeviceData> {
    constructor(log: Function, config: HubConfig, device: DeviceData, room: string, client: ComelitClient, homebridge: Homebridge) {
        super(log, config, device, room, client, homebridge);
    }

    identify(callback: Function) {
        this.log(`Comelit light identify: ${this.device.objectId}, ${this.device.descrizione} - ${this.room}`);
        callback();
    }

    getServices() {
        const Service = this.homebridge.hap.Service;
        const Characteristic = this.homebridge.hap.Characteristic;
        const accessoryInformation = new Service.AccessoryInformation(this.name, `${this.device.sub_type}`);
        accessoryInformation
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Unknown')
            .setCharacteristic(Characteristic.Model, 'None')
            .setCharacteristic(Characteristic.FirmwareRevision, 'None');

        const lightbulbService = new Service.Lightbulb(this.name, null);

        lightbulbService
            .addCharacteristic(Characteristic.StatusActive);

        lightbulbService
            .setCharacteristic(Characteristic.StatusActive, '1')
            .setCharacteristic(Characteristic.On, this.currentStatus);

        lightbulbService
            .getCharacteristic(Characteristic.StatusActive)
            .on(CharacteristicEventTypes.GET, async (callback: Function) => {
                const deviceData = await this.client.device(this.device.id);
                this.log(`Got active status of light ${this.device.id}`, deviceData);
                this.reachable = true;
                callback(null, ON);
            });

        lightbulbService
            .getCharacteristic(Characteristic.On)
            .on(CharacteristicEventTypes.GET, async (callback: Function) => {
                const deviceData = await this.client.device(this.device.descrizione);
                this.currentStatus = parseInt(deviceData.status);
                this.log(`Got status of light ${this.device.id}`, deviceData);
                callback(null, this.currentStatus);
            })
            .on(CharacteristicEventTypes.SET, async (state: number, callback: Function) => {
                await this.client.toggleLight(this.device.id, state ? ON : OFF);
                this.currentStatus = state ? ON : OFF;
                this.log(`Set status of light ${this.device.id} - ${this.currentStatus}`);
                callback()
            });

        return [accessoryInformation, lightbulbService]
    }
}


class ComelitThermostatAccessory extends ComelitAccessory<ThermostatDeviceData> {

    constructor(log: Function, config: HubConfig, device: ThermostatDeviceData, room: string, client: ComelitClient, homebridge: Homebridge) {
        super(log, config, device, room, client, homebridge);
    }

    getServices() {
        const Service = this.homebridge.hap.Service;
        const Characteristic = this.homebridge.hap.Characteristic;
        const accessoryInformation = new Service.AccessoryInformation(this.name, generateUUID(this.device.descrizione));
        accessoryInformation
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Comelit')
            .setCharacteristic(Characteristic.Model, 'None')
            .setCharacteristic(Characteristic.FirmwareRevision, 'None');

        const thermostatService = new Service.Thermostat(this.device.descrizione, null);
        thermostatService.setCharacteristic(Characteristic.CurrentHeatingCoolingState, this.device.est_inv === '0' ? COOL : HEAT);
        thermostatService.setCharacteristic(Characteristic.TargetHeatingCoolingState, this.device.est_inv === '0' ? COOL : HEAT);
        const temperature = parseFloat(`${this.device.temperatura.slice(1)}.${this.device.temperatura[this.device.temperatura.length - 1]}`);
        thermostatService.setCharacteristic(Characteristic.CurrentTemperature, temperature);
        const targetTemperature = parseFloat(`${this.device.soglia_attiva.slice(1)}.${this.device.soglia_attiva[this.device.soglia_attiva.length - 1]}`);
        thermostatService.setCharacteristic(Characteristic.TargetTemperature, targetTemperature);
        thermostatService.setCharacteristic(Characteristic.TemperatureDisplayUnits, CELSIUS);

        return [accessoryInformation, thermostatService];
    }
}