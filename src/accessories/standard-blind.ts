import { BlindDeviceData, ComelitClient, ObjectStatus } from 'comelit-client';
import { ComelitPlatform } from '../comelit-platform';
import { Callback, PlatformAccessory, Service } from 'homebridge';
import { PositionState } from './hap';
import { Blind } from './blind';
import { getPositionAsByte, getPositionAsPerc } from '../utils';
import Timeout = NodeJS.Timeout;

export class StandardBlind extends Blind {
  static readonly OPENING_CLOSING_TIME = 35; // 35 seconds to open approx. We should have this in the config

  private timeout: Timeout;
  private lastCommandTime: number = null;
  private readonly closingTime: number;

  constructor(
    platform: ComelitPlatform,
    accessory: PlatformAccessory,
    client: ComelitClient,
    closingTime?: number
  ) {
    super(platform, accessory, client);
    this.closingTime = (closingTime || Blind.OPENING_CLOSING_TIME) * 1000;
    this.log.info(`Blind ${this.device.id} has closing time of ${this.closingTime}`);
  }

  protected initServices(): Service[] {
    this.accessory.context = { ...this.device, position: getPositionAsByte(Blind.OPEN) };
    return super.initServices();
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
        this.positionState =
          position < currentPosition ? PositionState.DECREASING : PositionState.INCREASING;
        this.position = position;
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
    switch (status) {
      case ObjectStatus.ON:
      case ObjectStatus.OFF:
        if (this.lastCommandTime) {
          const position = this.positionFromTime();
          const positionAsByte = getPositionAsByte(position);
          this.log.debug(
            `Saved position ${positionAsByte} (${getPositionAsPerc(`${positionAsByte}`)}%)`
          );
          this.accessory.context = { ...this.device, position: positionAsByte };
          this.lastCommandTime = 0;
          this.log.info(`Blind is now at position ${position}`);
          this.coveringService
            .getCharacteristic(Characteristic.TargetPosition)
            .updateValue(position);
          this.coveringService
            .getCharacteristic(Characteristic.CurrentPosition)
            .updateValue(position);
          this.coveringService
            .getCharacteristic(Characteristic.PositionState)
            .updateValue(PositionState.STOPPED);
        } else {
          this.lastCommandTime = now; // external command (physical button)
        }
        break;
      case ObjectStatus.IDLE:
        this.lastCommandTime = now;
        break;
    }
    this.log.info(
      `Blind update: status ${status}, state ${this.positionState}, ts ${this.lastCommandTime}`
    );
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

  private positionFromTime() {
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
}
