import {ComelitAccessory} from "./comelit";
import {BlindDeviceData, ComelitClient, ObjectStatus} from "../comelit-client";
import {Callback, Categories, Characteristic, CharacteristicEventTypes, Service} from "hap-nodejs";
import {HomebridgeAPI} from "../index";
import {PositionState} from "hap-nodejs/dist/lib/gen/HomeKit";
import Timeout = NodeJS.Timeout;

export class Blind extends ComelitAccessory<BlindDeviceData> {
    static readonly OPEN = 100;
    static readonly CLOSED = 0;

    static readonly OPENING_CLOSING_TIME = 35000; // 35 seconds to open approx. We should have this in the config

    private coveringService: Service;
    private timeout: Timeout;
    private lastCommandTime: number;

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
            .on(CharacteristicEventTypes.SET, async (position: number, callback: Callback) => {
                try {
                    if (this.timeout) {
                        // A timeout was set, this means that we are already opening or closing the blind
                        // Stop the blind and calculate a rough position
                        const now = new Date().getTime();
                        clearTimeout(this.timeout);
                        this.timeout = null;
                        await this.client.toggleDeviceStatus(this.device.id, ObjectStatus.OFF); // stop the blind
                        const diff = Blind.OPENING_CLOSING_TIME - (now - this.lastCommandTime);
                        const newPosition = 100/ (Blind.OPENING_CLOSING_TIME / diff);
                        this.coveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(newPosition);
                        this.coveringService.getCharacteristic(Characteristic.TargetPosition).updateValue(newPosition);
                        this.coveringService.getCharacteristic(Characteristic.PositionState).updateValue(PositionState.STOPPED);
                        callback();
                        return;
                    }

                    const currentPosition = this.coveringService.getCharacteristic(Characteristic.CurrentPosition).value as number;
                    const status = position < currentPosition ? ObjectStatus.OFF : ObjectStatus.ON;
                    const delta = currentPosition - position;
                    this.log(`Setting value for blind ${this.name} to ${position}. Current position is ${currentPosition}. Delta is ${delta}`);
                    if (delta !== 0) {
                        await this.client.toggleDeviceStatus(this.device.id, status);
                        this.lastCommandTime = new Date().getTime();
                        this.timeout = setTimeout(async () => {
                            if (position > Blind.CLOSED && position < Blind.OPEN) {
                                // We stop the blind only for mid positions, otherwise it would stop by itself
                                this.log(`Stopping blind to ${position}%`);
                                await this.client.toggleDeviceStatus(this.device.id, position < currentPosition ? ObjectStatus.ON : ObjectStatus.OFF);
                            }
                            this.coveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(position);
                            this.timeout = null;
                            this.lastCommandTime = 0;
                        }, Blind.OPENING_CLOSING_TIME * Math.abs(delta) / 100);
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
        const now = new Date().getTime();
        if (status === ObjectStatus.IDLE) {
            this.lastCommandTime = now;
        }
    }
}
