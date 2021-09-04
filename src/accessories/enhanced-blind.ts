import { BlindDeviceData, ComelitClient } from 'comelit-client';
import { ComelitPlatform } from '../comelit-platform';
import { Callback, PlatformAccessory } from 'homebridge';
import { PositionState } from './hap';
import { Blind } from './blind';
import { getPositionAsByte, getPositionAsPerc } from '../utils';

export class EnhancedBlind extends Blind {
  constructor(platform: ComelitPlatform, accessory: PlatformAccessory, client: ComelitClient) {
    super(platform, accessory, client);
  }

  public async setPosition(position: number, callback: Callback) {
    const Characteristic = this.platform.Characteristic;
    try {
      const currentPosition = this.coveringService.getCharacteristic(Characteristic.CurrentPosition)
        .value as number;
      this.log.info(`Setting position to ${position}%. Current position is ${currentPosition}`);
      this.coveringService.getCharacteristic(Characteristic.TargetPosition).updateValue(position);
      await this.client.setBlindPosition(this.device.id, getPositionAsByte(position));
      callback();
    } catch (e) {
      this.log.error(e.message);
      callback(e);
    }
  }

  public update(data: BlindDeviceData) {
    const Characteristic = this.platform.Characteristic;
    const position = getPositionAsPerc(data.position);
    const status = parseInt(data.status); // can be 1 (increasing), 2 (decreasing) or 0 (stopped)
    this.positionState = this.getPositionStateFromDeviceData();
    this.coveringService.getCharacteristic(Characteristic.TargetPosition).updateValue(position);
    this.coveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(position);
    switch (status) {
      case 0:
        this.coveringService
          .getCharacteristic(Characteristic.PositionState)
          .updateValue(PositionState.STOPPED);
        break;
      case 1:
        this.coveringService
          .getCharacteristic(Characteristic.PositionState)
          .updateValue(PositionState.INCREASING);
        break;
      case 2:
        this.coveringService
          .getCharacteristic(Characteristic.PositionState)
          .updateValue(PositionState.DECREASING);
        break;
    }
  }

  protected getPositionFromDeviceData(): number {
    return getPositionAsPerc(this.device.position);
  }

  protected getPositionStateFromDeviceData(): number {
    const status = parseInt(this.device.status); // can be 1 (increasing), 2 (decreasing) or 0 (stopped)
    switch (status) {
      case 0:
        return PositionState.STOPPED;
      case 1:
        return PositionState.INCREASING;
      case 2:
        return PositionState.DECREASING;
    }
  }
}
