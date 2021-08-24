import { BlindDeviceData, ComelitClient, ObjectStatus } from 'comelit-client';
import { ComelitPlatform } from '../comelit-platform';
import { Callback, PlatformAccessory } from 'homebridge';
import { PositionState } from './hap';
import { Blind } from './blind';
import Timeout = NodeJS.Timeout;

export class StandardBlind extends Blind {
  static readonly OPENING_CLOSING_TIME = 35; // 35 seconds to open approx. We should have this in the config

  private timeout: Timeout;
  private lastCommandTime: number;
  private readonly closingTime: number;

  constructor(
    platform: ComelitPlatform,
    accessory: PlatformAccessory,
    client: ComelitClient,
    closingTime?: number
  ) {
    super(platform, accessory, client);
    this.closingTime = (closingTime || Blind.OPENING_CLOSING_TIME) * 1000;
    this.log.info(`Blind ${accessory.context.id} has closing time of ${this.closingTime}`);
  }

  public async setPosition(position: number, callback: Callback) {
    const Characteristic = this.platform.Characteristic;
    try {
      if (this.timeout) {
        await this.resetTimeout();
        callback();
        return;
      }

      const currentPosition = this.coveringService.getCharacteristic(Characteristic.CurrentPosition)
        .value as number;
      const status = position < currentPosition ? ObjectStatus.OFF : ObjectStatus.ON;
      const delta = currentPosition - position;
      this.log.info(
        `Setting position to ${position}%. Current position is ${currentPosition}. Delta is ${delta}`
      );
      if (delta !== 0) {
        await this.client.toggleDeviceStatus(this.device.id, status);
        this.lastCommandTime = new Date().getTime();
        this.timeout = setTimeout(async () => {
          return this.resetTimeout();
        }, (this.closingTime * Math.abs(delta)) / 100);
      }
      callback();
    } catch (e) {
      this.log.error(e.message);
      callback(e);
    }
  }

  private async resetTimeout() {
    // A timeout was set, this means that we are already opening or closing the blind
    // Stop the blind and calculate a rough position
    this.log.info(`Stopping blind`);
    clearTimeout(this.timeout);
    this.timeout = null;
    await this.client.toggleDeviceStatus(
      this.device.id,
      this.positionState === PositionState.DECREASING ? ObjectStatus.ON : ObjectStatus.OFF
    ); // stop the blind
  }

  public update(data: BlindDeviceData) {
    const Characteristic = this.platform.Characteristic;
    const status = parseInt(data.status);
    const now = new Date().getTime();
    this.positionState = this.getPositionStateFromState(data);
    switch (status) {
      case ObjectStatus.ON:
        this.lastCommandTime = now;
        break;
      case ObjectStatus.OFF: {
        const position = this.getPositionFromState(data);
        this.lastCommandTime = 0;
        this.log.info(
          `Blind is now at position ${position} (it was ${
            this.positionState === PositionState.DECREASING ? 'going down' : 'going up'
          })`
        );
        this.coveringService.getCharacteristic(Characteristic.TargetPosition).updateValue(position);
        this.coveringService
          .getCharacteristic(Characteristic.CurrentPosition)
          .updateValue(position);
        this.coveringService
          .getCharacteristic(Characteristic.PositionState)
          .updateValue(PositionState.STOPPED);
        break;
      }
      case ObjectStatus.IDLE:
        this.lastCommandTime = now;
        break;
    }
    this.log.info(
      `Blind update: status ${status}, state ${this.positionState}, ts ${this.lastCommandTime}`
    );
  }

  protected getPositionFromState(_data: BlindDeviceData): number {
    if (this.lastCommandTime) {
      const Characteristic = this.platform.Characteristic;
      const now = new Date().getTime();
      // Calculate the number of milliseconds the blind moved
      const delta = now - this.lastCommandTime;
      const currentPosition = this.coveringService.getCharacteristic(Characteristic.CurrentPosition)
        .value as number;
      // Calculate the percentage of movement
      const deltaPercentage = Math.round(delta / (this.closingTime / 100));
      this.log.info(
        `Current position ${currentPosition}, delta is ${delta} (${deltaPercentage}%). State ${this.positionState}`
      );
      if (this.positionState === PositionState.DECREASING) {
        // Blind is decreasing, subtract the delta
        return currentPosition - deltaPercentage;
      }
      // Blind is increasing, add the delta
      return currentPosition + deltaPercentage;
    }
    // by default we set initial state to open (100).
    // This means that when restarting homebridge you should have your blinds all opened, since we can't determine the
    // initial state
    return StandardBlind.OPEN;
  }

  protected getPositionStateFromState(data: BlindDeviceData): number {
    const status = parseInt(data.status); // can be 1 (increasing), 2 (decreasing) or 0 (stopped)
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
