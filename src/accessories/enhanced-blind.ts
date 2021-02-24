import { BlindDeviceData, ComelitClient, ObjectStatus } from 'comelit-client';
import { ComelitPlatform } from '../comelit-platform';
import { Callback, PlatformAccessory } from 'homebridge';
import { PositionState } from './hap';
import { Blind } from './blind';

/**
 * Returns the position as a value between 0 and 255
 * @param position number 0-100
 */
function getPositionAsByte(position: number) {
  return Math.round(position * 2.55);
}

/**
 * Returns the position as a value between 0 and 100
 * @param position number 0-255
 */
function getPositionAsPerc(position: string) {
  return Math.round(parseInt(position) / 2.55);
}

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
    switch (status) {
      case ObjectStatus.ON:
        this.positionState = PositionState.INCREASING;
        break;
      case ObjectStatus.OFF: {
        this.log.info(
          `Blind is now at position ${position} (it was ${
            this.positionState === PositionState.DECREASING ? 'closing' : 'opening'
          })`
        );
        this.positionState = PositionState.STOPPED;
        this.coveringService.getCharacteristic(Characteristic.TargetPosition).updateValue(position);
        this.coveringService
          .getCharacteristic(Characteristic.CurrentPosition)
          .updateValue(position);
        break;
      }
      case ObjectStatus.IDLE:
        this.positionState = PositionState.DECREASING;
        break;
    }

    this.coveringService
      .getCharacteristic(Characteristic.PositionState)
      .updateValue(this.positionState);
    this.coveringService.getCharacteristic(Characteristic.TargetPosition).updateValue(position);
    this.coveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(position);
  }
}
