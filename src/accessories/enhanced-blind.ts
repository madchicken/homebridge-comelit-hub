import { BlindDeviceData, ComelitClient, ObjectStatus } from 'comelit-client';
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
      this.coveringService.setCharacteristic(
        Characteristic.PositionState,
        position > currentPosition ? PositionState.INCREASING : PositionState.DECREASING
      );
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
    if (status === ObjectStatus.OFF) {
      this.log.info(
        `Blind is now at position ${position} (it was ${
          this.positionState === PositionState.DECREASING ? 'closing' : 'opening'
        })`
      );
      this.coveringService.getCharacteristic(Characteristic.TargetPosition).updateValue(position);
      this.coveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(position);
    }

    this.coveringService
      .getCharacteristic(Characteristic.PositionState)
      .updateValue(this.positionState);
    this.coveringService.getCharacteristic(Characteristic.TargetPosition).updateValue(position);
    this.coveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(position);
  }

  protected getPositionFromDeviceData(): number {
    return getPositionAsPerc(this.device.position);
  }

  protected getPositionStateFromDeviceData(): number {
    const status = parseInt(this.device.status); // can be 1 (increasing), 2 (decreasing) or 0 (stopped)
    switch (status) {
      case ObjectStatus.ON:
        return PositionState.INCREASING;
      case ObjectStatus.OFF:
        return PositionState.STOPPED;
      case ObjectStatus.IDLE:
        return PositionState.DECREASING;
    }
  }
}
