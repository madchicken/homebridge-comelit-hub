import {ComelitAccessory} from "./comelit";
import {ComelitClient, DeviceData, LightDeviceData, ObjectStatus} from "../comelit-client";
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

        const status = parseInt(this.device.status);
        this.lightbulbService = new HomebridgeAPI.hap.Service.Lightbulb(this.name, null);

        this.lightbulbService
            .addCharacteristic(Characteristic.StatusActive);

        this.lightbulbService
            .setCharacteristic(Characteristic.StatusActive, true)
            .setCharacteristic(Characteristic.On, status === ObjectStatus.ON);

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
                callback(null, this.device.status);
            })
            .on(CharacteristicEventTypes.SET, async (yes: boolean, callback: Function) => {
                const status = yes ? ObjectStatus.ON : ObjectStatus.OFF;
                try {
                    await this.client.toggleDeviceStatus(this.device.id, status);
                    this.device.status = `${status}`;
                    callback()
                } catch (e) {
                    callback(e);
                }
            });

        return [accessoryInformation, this.lightbulbService]
    }

    public update(data: LightDeviceData) {
        const status = parseInt(data.status) === ObjectStatus.ON;
        console.log(`Updating status of light ${this.device.id}. New status is ${status}`);
        this.lightbulbService.getCharacteristic(Characteristic.On).updateValue(status);
    }
}
