import {ComelitAccessory} from "./comelit";
import {ComelitClient, DeviceData, LightDeviceData} from "../comelit-client";
import {Categories, Characteristic, CharacteristicEventTypes, Service} from "hap-nodejs";
import {HomebridgeAPI} from "../index";

export class Lightbulb extends ComelitAccessory<LightDeviceData> {
    static readonly ON = 1;
    static readonly OFF = 0;

    private lightbulbService: Service;

    constructor(log: Function, device: DeviceData, name: string, client: ComelitClient) {
        super(log, device, name, client, Categories.LIGHTBULB);
    }

    protected initServices(): Service[] {
        const accessoryInformation = this.initAccessoryInformation(); // common info about the accessory

        this.lightbulbService = new HomebridgeAPI.hap.Service.Lightbulb(this.name, null);

        this.lightbulbService
            .addCharacteristic(Characteristic.StatusActive);

        this.lightbulbService
            .setCharacteristic(Characteristic.StatusActive, true)
            .setCharacteristic(Characteristic.On, parseInt(this.device.status));

        this.lightbulbService
            .getCharacteristic(Characteristic.StatusActive)
            .on(CharacteristicEventTypes.GET, async (callback: Function) => {
                const deviceData = this.device;
                const reachable = !!deviceData;
                callback(null, reachable);
            });

        this.lightbulbService
            .getCharacteristic(Characteristic.On)
            .on(CharacteristicEventTypes.GET, async (callback: Function) => {
                const deviceData = await this.client.device(this.device.id);
                callback(null, parseInt(deviceData.status));
            })
            .on(CharacteristicEventTypes.SET, async (state: number, callback: Function) => {
                const status = state ? Lightbulb.ON : Lightbulb.OFF;
                try {
                    await this.client.toggleLight(this.device.id, status);
                    this.device.status = `${status}`;
                    callback()
                } catch (e) {
                    callback(e);
                }
            });

        return [accessoryInformation, this.lightbulbService]
    }

    public update(data: LightDeviceData) {
        const status = parseInt(data.status);
        console.log(`Updating status of light ${this.device.id}. New status is ${status}`);
        this.lightbulbService.getCharacteristic(Characteristic.On).updateValue(status);
    }
}