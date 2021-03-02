import { ComelitAccessory } from './comelit';
import { BlindDeviceData, ComelitClient, OBJECT_SUBTYPE } from 'comelit-client';
import { ComelitPlatform } from '../comelit-platform';
import { CharacteristicEventTypes, PlatformAccessory, Service } from 'homebridge';
import { PositionState } from './hap';
import { CharacteristicSetCallback } from 'hap-nodejs';

export abstract class Blind extends ComelitAccessory<BlindDeviceData> {
  static readonly OPEN = 100;
  static readonly CLOSED = 0;

  static readonly OPENING_CLOSING_TIME = 35; // 35 seconds to open approx. We should have this in the config

  protected coveringService: Service;
  protected positionState: number;

  constructor(platform: ComelitPlatform, accessory: PlatformAccessory, client: ComelitClient) {
    super(platform, accessory, client);
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation();

    const Characteristic = this.platform.Characteristic;
    this.coveringService =
      this.accessory.getService(this.platform.Service.WindowCovering) ||
      this.accessory.addService(this.platform.Service.WindowCovering);

    this.coveringService.setCharacteristic(Characteristic.PositionState, PositionState.STOPPED);
    this.coveringService.setCharacteristic(Characteristic.TargetPosition, Blind.OPEN);
    this.coveringService.setCharacteristic(Characteristic.CurrentPosition, Blind.OPEN);
    this.positionState = PositionState.STOPPED;

    this.coveringService
      .getCharacteristic(Characteristic.TargetPosition)
      .on(
        CharacteristicEventTypes.SET,
        async (position: number, callback: CharacteristicSetCallback) => {
          await this.setPosition(position, callback);
        }
      );

    return [accessoryInformation, this.coveringService];
  }

  public abstract setPosition(position: number, callback: CharacteristicSetCallback): Promise<void>;

  public abstract update(data: BlindDeviceData);
}
