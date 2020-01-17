import {ComelitAccessory} from "./comelit";
import {BlindDeviceData, ComelitClient} from "../comelit-client";
import {Categories, Characteristic, CharacteristicEventTypes, NodeCallback, Service} from "hap-nodejs";
import {HomebridgeAPI} from "../index";

export class Blind extends ComelitAccessory<BlindDeviceData> {
    static readonly DECREASING = 0;
    static readonly INCREASING = 1;
    static readonly STOPPED = 2;
    static readonly OPEN = 1;
    static readonly CLOSED = 0;

    static readonly OPENING_TIME = 35000; // 35 seconds to open approx.

    private coveringService: Service;

    constructor(log: Function, device: BlindDeviceData, name: string, client: ComelitClient) {
        super(log, device, name, client, Categories.WINDOW_COVERING);
    }

    protected initServices(): Service[] {
        const accessoryInformation = this.initAccessoryInformation();

        this.coveringService = new HomebridgeAPI.hap.Service.WindowCovering(this.device.descrizione, null);

        const status = parseInt(this.device.status);
        this.coveringService.setCharacteristic(Characteristic.CurrentPosition, status == Blind.OPEN ? 100 : 0);
        //this.coveringService.setCharacteristic(Characteristic.TargetPosition, status == Blind.OPEN ? 0 : 100);
        this.coveringService.setCharacteristic(Characteristic.PositionState, Blind.STOPPED);

        this.coveringService
            .getCharacteristic(Characteristic.TargetPosition)
            .on(CharacteristicEventTypes.SET, async (state: number, callback: Function) => {
                const newStatus = state > 0 ? Blind.OPEN : Blind.CLOSED;
                const currentStatus = this.device.status === '1' ? Blind.CLOSED : Blind.OPEN;
                if (newStatus !== currentStatus) {
                    await this.client.toggleBlind(this.device.id, newStatus);
                    this.device.status = `${newStatus}`;
                }
                callback(null);
            });

        this.coveringService
            .getCharacteristic(Characteristic.CurrentPosition)
            .on(CharacteristicEventTypes.GET, async (callback: Function) => {
                const position = this.device.status === '0' ? Blind.CLOSED : Blind.OPEN;
                callback(null, position);
            })
            .on(CharacteristicEventTypes.GET, async (callback: NodeCallback<number>) => {
                try {
                    const data = await this.client.device(this.device.id);
                    callback(null, data.status === '2' ? Blind.OPEN : Blind.CLOSED);
                } catch (e) {
                    callback(e);
                }
            });

        return [accessoryInformation, this.coveringService];
    }

    public update(data: BlindDeviceData) {
        this.device = data;
        this.coveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(data.status === '2' ? Blind.OPEN : Blind.CLOSED)
    }
}