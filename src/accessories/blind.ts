import {ComelitAccessory} from "./comelit";
import {BlindDeviceData, ComelitClient} from "../comelit-client";
import {Categories, CharacteristicEventTypes, Service} from "hap-nodejs";
import {HomebridgeAPI} from "../index";

export class Blind extends ComelitAccessory<BlindDeviceData> {
    static readonly DECREASING = 0;
    static readonly INCREASING = 1;
    static readonly STOPPED = 2;
    static readonly OPEN = 1;
    static readonly CLOSED = 0;

    static readonly OPENING_TIME = 35000; // 35 seconds to open approx.

    constructor(log: Function, device: BlindDeviceData, name: string, client: ComelitClient) {
        super(log, device, name, client, Categories.WINDOW_COVERING);
    }

    protected initServices(): Service[] {
        const Characteristic = HomebridgeAPI.hap.Characteristic;
        const accessoryInformation = this.initAccessoryInformation();

        const coveringService = new HomebridgeAPI.hap.Service.WindowCovering(this.device.descrizione, null);

        const status = parseInt(this.device.status);
        coveringService.setCharacteristic(Characteristic.CurrentPosition, status == Blind.OPEN ? 100 : 0);
        //coveringService.setCharacteristic(Characteristic.TargetPosition, status == Blind.OPEN ? 0 : 100);
        coveringService.setCharacteristic(Characteristic.PositionState, Blind.STOPPED);

        coveringService
            .getCharacteristic(Characteristic.TargetPosition)
            .on(CharacteristicEventTypes.SET, async (state: number, callback: Function) => {
                const newStatus = state > 0 ? Blind.OPEN : Blind.CLOSED;
                const currentStatus = this.device.status === '2' ? Blind.CLOSED : Blind.OPEN;
                if (newStatus !== currentStatus) {
                    await this.client.toggleBlind(this.device.id, newStatus);
                    this.device.status = `${newStatus}`;
                }
                callback(null);
            });

        coveringService
            .getCharacteristic(Characteristic.CurrentPosition)
            .on(CharacteristicEventTypes.GET, async (callback: Function) => {
                const position = this.device.status === '0' ? Blind.CLOSED : Blind.OPEN;
                callback(null, position);
            });

        return [accessoryInformation, coveringService];
    }

    protected update(data: BlindDeviceData) {
        this.device = data;
    }
}