import {Accessory, Characteristic, Service} from "hap-nodejs";

export interface Homebridge {
    version: string;
    platformAccessory: Accessory;
    registerPlatform: (longName: string, name: string, platform: Function, dynamic: boolean) => void;
    hap: {
        Service: typeof Service;
        Characteristic: typeof Characteristic;
    };
    on: (message: string, callback: Function) => void;
}