import {ComelitAccessory} from "./comelit";
import {BlindDeviceData, ComelitClient} from "../comelit-client";
import {Categories, Characteristic, CharacteristicEventTypes, NodeCallback, Service} from "hap-nodejs";
import {HomebridgeAPI} from "../index";
import {PositionState} from "hap-nodejs/dist/lib/gen/HomeKit";

export class Blind extends ComelitAccessory<BlindDeviceData> {
    static readonly STOPPED = '0';
    static readonly OPENING = '1';
    static readonly CLOSING = '2';
    static readonly TOGGLE = 1;

    static readonly OPENING_TIME = 35000; // 35 seconds to open approx.

    private coveringService: Service;

    constructor(log: Function, device: BlindDeviceData, name: string, client: ComelitClient) {
        super(log, device, name, client, Categories.WINDOW_COVERING);
    }

    protected initServices(): Service[] {
        const accessoryInformation = this.initAccessoryInformation();

        this.coveringService = new HomebridgeAPI.hap.Service.WindowCovering(this.device.descrizione, null);

        this.coveringService.setCharacteristic(Characteristic.PositionState, Blind.STOPPED);
        this.coveringService.setCharacteristic(Characteristic.CurrentPosition, 0);

        this.coveringService
            .getCharacteristic(Characteristic.TargetPosition)
            .on(CharacteristicEventTypes.SET, async (state: number, callback: Function) => {
                try {
                    await this.client.toggleBlind(this.device.id, Blind.TOGGLE);
                    callback(null);
                } catch (e) {
                    callback(e);
                }
            });

        this.coveringService
            .getCharacteristic(Characteristic.PositionState)
            .on(CharacteristicEventTypes.GET, async (callback: NodeCallback<number>) => {
                try {
                    const data = await this.client.device(this.device.id);
                    let value;
                    switch (data.status) {
                        case Blind.OPENING:
                            value = PositionState.INCREASING;
                            break;
                        case Blind.CLOSING:
                            value = PositionState.DECREASING;
                            break;
                        default:
                            value = PositionState.STOPPED;
                            break;
                    }
                    this.log(`Set ${this.device.descrizione} blind position state to ${value}`);
                    callback(null, value);
                } catch (e) {
                    callback(e);
                }
            });

        return [accessoryInformation, this.coveringService];
    }

    public update(data: BlindDeviceData) {
        this.device = data;
        let value;
        switch (data.status) {
            case Blind.OPENING:
                value = PositionState.INCREASING;
                break;
            case Blind.CLOSING:
                value = PositionState.DECREASING;
                break;
            default:
                value = PositionState.STOPPED;
                break;
        }

        this.coveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(value);
    }
}