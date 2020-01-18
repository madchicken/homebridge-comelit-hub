import {Homebridge} from "./types";
import {ComelitClient, DeviceData} from "./comelit-client";
import {ComelitAccessory} from "./accessories/comelit";
import {Lightbulb} from "./accessories/lightbulb";
import {Thermostat} from "./accessories/thermostat";
import {Blind} from "./accessories/blind";

const ROOT_ID = 'GEN#17#13#1';

export interface HubConfig {
    username: string;
    password: string;
    hub_username: string;
    hub_password: string;
    broker_url: string;
    client_id: string;
}

export class ComelitPlatform {
    private readonly log: (message?: any, ...optionalParams: any[]) => void;
    private readonly homebridge: Homebridge;
    private client: ComelitClient;
    private readonly config: HubConfig;
    public mappedAccessories: Map<string, ComelitAccessory<DeviceData>> = new Map<string, ComelitAccessory<DeviceData>>();

    constructor(log: (message?: any, ...optionalParams: any[]) => void, config: HubConfig, homebridge: Homebridge) {
        this.log = (str: string) => log("[COMELIT HUB] " + str);
        this.log('Initializing platform: ', config);
        this.config = config;
        // Save the API object as plugin needs to register new accessory via this object
        this.homebridge = homebridge;
        this.log("homebridge API version: " + homebridge.version);
    }

    async accessories(callback: (array: any[]) => void) {
        this.log('Building accessories list...');
        if (!this.client) {
            try {
                this.log('Creating client and logging in...');
                this.client = new ComelitClient(this.updateAccessory, this.log);
                await this.client.init(
                    this.config.broker_url,
                    this.config.username,
                    this.config.password,
                    this.config.hub_username,
                    this.config.hub_password,
                );
                await this.client.login();
            } catch (e) {
                this.log(e);
                return [];
            }
        }
        if (this.client.isLogged()) {
            const rootElementInfo = await this.client.device(ROOT_ID);
            const homeIndex = this.client.mapHome(rootElementInfo);
            const lightIds = [...homeIndex.lightsIndex.keys()];
            this.log(`Found ${lightIds.length} lights`);

            lightIds.forEach(id => {
                const deviceData = homeIndex.lightsIndex.get(id);
                if (deviceData) {
                    this.log(`Light ID: ${id}, ${deviceData.descrizione}`);
                    this.mappedAccessories.set(id, new Lightbulb(this.log, deviceData, `Light ${deviceData.descrizione}`, this.client));
                }
            });
            const thermostatIds = [...homeIndex.thermostatsIndex.keys()];
            this.log(`Found ${thermostatIds.length} thermostats`);
            thermostatIds.forEach(id => {
                const deviceData = homeIndex.thermostatsIndex.get(id);
                if (deviceData) {
                    this.log(`Thermostat ID: ${id}, ${deviceData.descrizione}`);
                    this.mappedAccessories.set(id, new Thermostat(this.log, deviceData, `Thermostat ${deviceData.descrizione}`, this.client));
                }
            });
            const shadeIds = [...homeIndex.blindsIndex.keys()];
            this.log(`Found ${shadeIds.length} shades`);
            shadeIds.forEach(id => {
                const deviceData = homeIndex.blindsIndex.get(id);
                if (deviceData) {
                    this.log(`Blind ID: ${id}, ${deviceData.descrizione}`);
                    this.mappedAccessories.set(id, new Blind(this.log, deviceData, `Blind ${deviceData.descrizione}`, this.client));
                }
            });
        } else {
            this.log('Error logging in');
            this.mappedAccessories = new Map<string, ComelitAccessory<DeviceData>>();
        }

        this.log(`Found ${this.mappedAccessories.size} accessories`);
        for(const accessory of this.mappedAccessories.values()) {
            this.client.subscribeObject(accessory.device.id);
        }
        callback([...this.mappedAccessories.values()]);
    }

    updateAccessory(id: string, data: DeviceData) {
        const accessory = this.mappedAccessories.get(id);
        if (accessory) {
            accessory.update(data);
        }
    }
}