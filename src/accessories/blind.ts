import {ComelitAccessory} from "./comelit";
import {BlindDeviceData, ComelitClient, ObjectStatus} from "../comelit-client";
import {Categories, Characteristic, CharacteristicEventTypes, Service} from "hap-nodejs";
import {HomebridgeAPI} from "../index";
import {PositionState} from "hap-nodejs/dist/lib/gen/HomeKit";
import Timeout = NodeJS.Timeout;

export class Blind extends ComelitAccessory<BlindDeviceData> {
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

        this.coveringService.setCharacteristic(Characteristic.PositionState, PositionState.STOPPED);
        this.coveringService.setCharacteristic(Characteristic.TargetPosition, Blind.OPEN);
        this.coveringService.setCharacteristic(Characteristic.CurrentPosition, Blind.OPEN);

        this.coveringService
            .getCharacteristic(Characteristic.TargetPosition)
            .on(CharacteristicEventTypes.SET, async (state: number, callback: Function) => {
                try {
                    const currentPosition = this.coveringService.getCharacteristic(Characteristic.CurrentPosition).value as number;
                    const status = state < currentPosition ? ObjectStatus.OFF : ObjectStatus.ON;
                    const delta = state < currentPosition ? (currentPosition - state) : (state - currentPosition);
                    if (delta) {
                        if (this.timeout) {
                            clearTimeout(this.timeout);
                            this.timeout = null;
                            await this.client.toggleDeviceStatus(this.device.id, ObjectStatus.OFF); // stop the blind
                        }
                        await this.client.toggleDeviceStatus(this.device.id, status);
                        this.timeout = setTimeout(async () => {
                            this.log(`Stopping blind to ${state}%`);
                            await this.client.toggleDeviceStatus(this.device.id, ObjectStatus.OFF);
                            this.coveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(state);
                            this.timeout = null;
                        }, Blind.OPENING_CLOSING_TIME * delta / 100);
                    }
                    callback();
                } catch (e) {
                    callback(e);
                }
            });

        return [accessoryInformation, this.coveringService];
    }

    public update(data: BlindDeviceData) {
        const status = parseInt(data.status);
        if (status === ObjectStatus.IDLE) {
            this.coveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(Blind.CLOSED);
        } if (status === ObjectStatus.ON) {
            this.coveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(Blind.OPEN);
        } if (status === ObjectStatus.IDLE) {
            this.coveringService.getCharacteristic(Characteristic.PositionState).updateValue(PositionState.STOPPED);
        }
    }
}
