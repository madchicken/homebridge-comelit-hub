import {ComelitClient, DeviceData} from "../comelit-client";
import {Categories, Characteristic, Service} from "hap-nodejs";
import {HomebridgeAPI} from "../index";

export abstract class ComelitAccessory<T extends DeviceData> {
    readonly uuid_base: string;
    readonly log: Function;
    readonly name: string;
    readonly category: Categories;
    readonly device: T;
    readonly client: ComelitClient;

    services: Service[];
    reachable: boolean;

    protected constructor(log: Function, device: T, name: string, client: ComelitClient, category: Categories) {
        this.log = log;
        this.device = device;
        this.client = client;
        this.name = name;
        this.uuid_base = device.objectId;
        this.services = this.initServices();
        this.reachable = true;
        this.category = category;
    }

    getServices(): Service[] {
        return this.services;
    }

    identify(callback: Function) {
        callback();
    }

    protected initAccessoryInformation(): Service {
        const accessoryInformation = new HomebridgeAPI.hap.Service.AccessoryInformation(null, null);
        accessoryInformation
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Comelit')
            .setCharacteristic(Characteristic.Model, 'None')
            .setCharacteristic(Characteristic.FirmwareRevision, 'None');
        return accessoryInformation;
    }

    protected abstract initServices(): Service[];

    public abstract update(data: T);
}