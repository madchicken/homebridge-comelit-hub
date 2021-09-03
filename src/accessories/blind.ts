import { ComelitAccessory } from './comelit';
import { BlindDeviceData, ComelitClient } from 'comelit-client';
import { ComelitPlatform } from '../comelit-platform';
import { CharacteristicEventTypes, PlatformAccessory, Service } from 'homebridge';
import { CharacteristicSetCallback } from 'hap-nodejs';

export abstract class Blind extends ComelitAccessory<BlindDeviceData> {
  static readonly OPEN = 100;
  static readonly CLOSED = 0;

  static readonly CLOSING_TIME = 35; // 35 seconds to close approx.
  static readonly OPENING_TIME = 37; // 37 seconds to open approx.

  protected coveringService: Service;
  protected positionState: number;

  protected constructor(
    platform: ComelitPlatform,
    accessory: PlatformAccessory,
    client: ComelitClient
  ) {
    super(platform, accessory, client);
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation();

    const Characteristic = this.platform.Characteristic;
    this.coveringService =
      this.accessory.getService(this.platform.Service.WindowCovering) ||
      this.accessory.addService(this.platform.Service.WindowCovering);

    this.positionState = this.getPositionStateFromDeviceData();
    const position = this.getPositionFromDeviceData();

    this.coveringService.setCharacteristic(Characteristic.PositionState, this.positionState);
    this.coveringService.setCharacteristic(Characteristic.TargetPosition, position);
    this.coveringService.setCharacteristic(Characteristic.CurrentPosition, position);

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

  protected abstract getPositionFromDeviceData(): number;

  protected abstract getPositionStateFromDeviceData(): number;
}
