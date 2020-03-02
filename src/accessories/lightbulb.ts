import {ComelitAccessory} from "./comelit";
import {ComelitClient, DeviceData, LightDeviceData, ObjectStatus} from "../comelit-client";
import {Categories, Characteristic, CharacteristicEventTypes, Service} from "hap-nodejs";
import {HomebridgeAPI} from "../index";
import client from "prom-client";

const lightStatus = new client.Gauge({
    name: 'comelit_light_status',
    help: 'Lightbulb on/off',
    labelNames: ['light_name']
});
const lightCount = new client.Counter({
    name: 'comelit_light_total',
    help: 'Lightbulb on/off counter',
    labelNames: ['light_name']
});

export class Lightbulb extends ComelitAccessory<LightDeviceData> {
    static readonly ON = 1;
    static readonly OFF = 0;

    private lightbulbService: Service;

    constructor(log: Function, device: DeviceData, name: string, client: ComelitClient) {
        super(log, device, name, client, Categories.LIGHTBULB);
    }

    async identify(callback: Function) {
        if (this.isOn()) {
            this.lightbulbService
                .setCharacteristic(Characteristic.On, false);
            setTimeout(() => {
                this.lightbulbService
                    .setCharacteristic(Characteristic.On, true);
                callback();
            }, 1000);
        } else {
            this.lightbulbService
                .setCharacteristic(Characteristic.On, true);
            setTimeout(() => {
                this.lightbulbService
                    .setCharacteristic(Characteristic.On, false);
                callback();
            }, 1000);
        }
    }

    isOn(): boolean {
        return parseInt(this.device.status) === ObjectStatus.ON;
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
            .getCharacteristic(Characteristic.On)
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
        lightStatus.set({light_name: data.descrizione}, parseInt(data.status));
        if (status) {
            lightCount.inc({light_name: data.descrizione});
        }
        this.lightbulbService.getCharacteristic(Characteristic.On).updateValue(status);
    }
}
