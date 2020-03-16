import {ComelitAccessory} from "./comelit";
import {ComelitClient, OutletDeviceData} from "comelit-client";
import {Categories, Characteristic, CharacteristicEventTypes, Formats, Perms, Service} from "hap-nodejs";
import {HomebridgeAPI} from "../index";
import client from "prom-client";

const singleConsumption = new client.Gauge({ name: 'comelit_plug_consumption', help: 'Consumption for single line in Wh', labelNames: ['plug_name']});

class Consumption extends Characteristic {
    static readonly UUID: string = '00000029-0000-2000-8000-0026BB765291';

    constructor() {
        super('Power consumption', Consumption.UUID);
        this.setProps({
            format: Formats.STRING,
            perms: [Perms.READ, Perms.WRITE, Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    }
}

export class Outlet extends ComelitAccessory<OutletDeviceData> {
    static readonly ON = 1;
    static readonly OFF = 0;

    private outletService: Service;

    constructor(log: Function, device: OutletDeviceData, name: string, client: ComelitClient) {
        super(log, device, name, client, Categories.OUTLET);
    }

    protected initServices(): Service[] {
        const accessoryInformation = this.initAccessoryInformation();

        this.outletService = new HomebridgeAPI.hap.Service.Outlet(this.device.descrizione, null);
        this.outletService.addOptionalCharacteristic(Consumption);
        this.update(this.device);
        this.outletService.getCharacteristic(Characteristic.InUse).on(CharacteristicEventTypes.GET, async (callback: Function) => {
            const power = parseFloat(this.device.instant_power);
            callback(null, power > 0);
        });
        this.outletService.getCharacteristic(Characteristic.On).on(CharacteristicEventTypes.SET, async (yes: boolean, callback: Function) => {
            const status = yes ? Outlet.ON : Outlet.OFF;
            try {
                await this.client.toggleDeviceStatus(this.device.id, status);
                this.device.status = `${status}`;
                callback()
            } catch (e) {
                callback(e);
            }
        });
        this.outletService.getCharacteristic(Consumption).on(CharacteristicEventTypes.GET, async (callback: Function) => {
            callback(null, `${this.device.instant_power} W`);
        });

        return [accessoryInformation, this.outletService];
    }

    public update(data: OutletDeviceData) {
        const status = parseInt(data.status);
        this.outletService.getCharacteristic(Characteristic.On).updateValue(status > 0);
        const power = parseFloat(data.instant_power);
        this.outletService.getCharacteristic(Characteristic.InUse).updateValue(power > 0);
        this.outletService.getCharacteristic(Consumption).updateValue(`${data.instant_power} W`);
        this.log(`Reporting consumption for ${data.descrizione}: ${data.instant_power}Wh`);
        singleConsumption.set({ plug_name: data.descrizione }, power);
    }
}
