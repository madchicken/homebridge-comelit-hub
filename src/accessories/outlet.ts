import {ComelitAccessory} from "./comelit";
import {ComelitClient, OutletDeviceData} from "../comelit-client";
import {Categories, Characteristic, CharacteristicEventTypes, Service} from "hap-nodejs";
import {HomebridgeAPI} from "../index";

export class Outlet extends ComelitAccessory<OutletDeviceData> {
    private outletService: Service;


    constructor(log: Function, device: OutletDeviceData, name: string, client: ComelitClient) {
        super(log, device, name, client, Categories.OUTLET);
    }

    protected initServices(): Service[] {
        const accessoryInformation = this.initAccessoryInformation();

        this.outletService = new HomebridgeAPI.hap.Service.Outlet(this.device.descrizione, null);
        this.outletService.getCharacteristic(Characteristic.InUse).on(CharacteristicEventTypes.GET, async (callback: Function) => {
            callback(null, this.device.instant_power > 0);
        });
        this.update(this.device);

        return [accessoryInformation, this.outletService];
    }

    public update(data: OutletDeviceData) {
        this.outletService.setCharacteristic(Characteristic.On, true);
        this.outletService.setCharacteristic(Characteristic.InUse, data.instant_power > 0);
    }
}
