import {ComelitAccessory} from "./comelit";
import {ComelitClient, OutletDeviceData} from "../comelit-client";
import {Categories, Characteristic, CharacteristicEventTypes, Service} from "hap-nodejs";
import {HomebridgeAPI} from "../index";

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
        this.update(this.device);
        this.outletService.getCharacteristic(Characteristic.InUse).on(CharacteristicEventTypes.GET, async (callback: Function) => {
            callback(null, this.device.instant_power > 0);
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

        return [accessoryInformation, this.outletService];
    }

    public update(data: OutletDeviceData) {
        this.outletService.getCharacteristic(Characteristic.On).updateValue(parseInt(data.status) > 0);
        this.outletService.getCharacteristic(Characteristic.InUse).updateValue(data.instant_power > 0);
    }
}
