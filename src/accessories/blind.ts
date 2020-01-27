import {ComelitAccessory} from "./comelit";
import {BlindDeviceData, ComelitClient} from "../comelit-client";
import {Categories, Characteristic, CharacteristicEventTypes, Service} from "hap-nodejs";
import {HomebridgeAPI} from "../index";
import Timeout = NodeJS.Timeout;

export class Blind extends ComelitAccessory<BlindDeviceData> {
    static readonly STOPPED = '0';
    static readonly OPENING = '1';
    static readonly CLOSING = '2';
    static readonly TOGGLE_OPEN = 1;
    static readonly TOGGLE_CLOSE = 0;
    static readonly OPEN = 100;
    static readonly CLOSED = 0;

    static readonly OPENING_CLOSING_TIME = 35000; // 35 seconds to open approx.

    private coveringService: Service;
    private timeout: Timeout;

    constructor(log: Function, device: BlindDeviceData, name: string, client: ComelitClient) {
        super(log, device, name, client, Categories.WINDOW_COVERING);
    }

    protected initServices(): Service[] {
        const accessoryInformation = this.initAccessoryInformation();

        this.coveringService = new HomebridgeAPI.hap.Service.WindowCovering(this.device.descrizione, null);

        this.coveringService.setCharacteristic(Characteristic.PositionState, Blind.STOPPED);
        this.coveringService.setCharacteristic(Characteristic.TargetPosition, Blind.OPEN);
        this.coveringService.setCharacteristic(Characteristic.CurrentPosition, Blind.OPEN);

        this.coveringService
            .getCharacteristic(Characteristic.TargetPosition)
            .on(CharacteristicEventTypes.SET, async (state: number, callback: Function) => {
                try {
                    const currentPosition = this.coveringService.getCharacteristic(Characteristic.CurrentPosition).value as number;
                    const status = state < currentPosition ? Blind.TOGGLE_CLOSE : Blind.TOGGLE_OPEN;
                    const delta = Math.abs(state - currentPosition);
                    if (this.timeout) {
                        clearTimeout(this.timeout);
                        this.timeout = null;
                        await this.client.toggleBlind(this.device.id, Blind.TOGGLE_CLOSE); // stop the blind
                    }
                    await this.client.toggleBlind(this.device.id, status);
                    this.timeout = setTimeout(async () => {
                        this.log(`Stopping blind to ${state}%`);
                        await this.client.toggleBlind(this.device.id, Blind.TOGGLE_CLOSE);
                        this.coveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(status);
                    }, Blind.OPENING_CLOSING_TIME * delta / 100);
                    callback(null);
                } catch (e) {
                    callback(e);
                }
            });

        return [accessoryInformation, this.coveringService];
    }

    public update(data: BlindDeviceData) {
        let value;
        if (data.status === Blind.CLOSING) {
            value = Blind.CLOSED;
        } else {
            value = Blind.OPEN;
        }

        this.coveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(value);
    }
}
