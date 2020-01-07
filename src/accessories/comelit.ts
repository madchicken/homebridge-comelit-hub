import {ComelitClient, DeviceData} from "../comelit-client";
import {Categories, Service} from "hap-nodejs";
import {HomebridgeAPI} from "../index";

export abstract class ComelitAccessory<T extends DeviceData> {
    log: Function;
    device: T;
    client: ComelitClient;
    readonly uuid_base: string;
    name: string;
    services: Service[];
    reachable: boolean;

    constructor(log: Function, device: T, name: string, client: ComelitClient, category: Categories) {
        const a = new HomebridgeAPI.platformAccessory(name, HomebridgeAPI.hap.uuid.generate(`${device.objectId}:${device.descrizione}`), category);
        Object.assign(this, a);
        this.log = log;
        this.device = device;
        this.client = client;
        this.name = name;
        this.uuid_base = device.objectId;
        this.services = this.initServices();
        this.reachable = true;
    }

    getServices(): Service[] {
        return this.services;
    }

    protected initAccessoryInformation(): Service {
        const Characteristic = HomebridgeAPI.hap.Characteristic;
        const accessoryInformation = new HomebridgeAPI.hap.Service.AccessoryInformation(null, null);
        accessoryInformation
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Comelit')
            .setCharacteristic(Characteristic.Model, 'None')
            .setCharacteristic(Characteristic.FirmwareRevision, 'None');
        return accessoryInformation;
    }

    protected abstract initServices(): Service[];

    protected abstract update(data: T);
}