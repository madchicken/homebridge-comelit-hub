import { BlindDeviceData, ComelitClient } from 'comelit-client';
import { ComelitPlatform } from '../comelit-platform';
import { Callback, PlatformAccessory, Service } from 'homebridge';
import { PositionState } from './hap';
import { Blind } from './blind';
import { getPositionAsByte, getPositionAsPerc } from '../utils';
import Timeout = NodeJS.Timeout;

export class StandardBlind extends Blind {
  private timeout: Timeout;
  private lastCommandTime: number = null;
  private readonly closingTime: number;
  private readonly openingTime: number;

  constructor(
    platform: ComelitPlatform,
    accessory: PlatformAccessory,
    client: ComelitClient,
    openingTime?: number,
    closingTime?: number
  ) {
    super(platform, accessory, client);
    this.closingTime = (closingTime || Blind.CLOSING_TIME) * 1000;
    this.openingTime = (openingTime || Blind.OPENING_TIME) * 1000;
    this.log.info(`Blind ${this.device.id} has closing time of ${this.closingTime}`);
    this.log.info(`Blind ${this.device.id} has opening time of ${this.openingTime}`);
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
      const status = position < currentPosition ? 0 : 1;
      const delta = currentPosition - position;
      this.log.info(
        `[Set Position] Setting position to ${position}%. Current position is ${currentPosition}. Delta is ${delta}. Blind is now ${
          status === 1 ? 'opening' : 'closing'
        }`
      );
      if (delta !== 0) {
        this.positionState =
          position < currentPosition ? PositionState.DECREASING : PositionState.INCREASING;
        await this.client.toggleDeviceStatus(this.device.id, status);
        this.lastCommandTime = new Date().getTime();
        this.coveringService.getCharacteristic(Characteristic.TargetPosition).updateValue(position);
        const time = status === 1 ? this.openingTime : this.closingTime;
        const ms = (time * Math.abs(delta)) / 100;
        this.timeout = setTimeout(async () => {
          return this.resetTimeout();
        }, ms);
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
    this.log.info(`[Reset timeout] Stopping blind`);
    clearTimeout(this.timeout);
    this.timeout = null;
    await this.client.toggleDeviceStatus(
      this.device.id,
      this.positionState === PositionState.DECREASING ? 1 : 0
    ); // stop the blind
  }

  public update(data: BlindDeviceData) {
    const status = parseInt(data.status);
    const statusDesc = status === 0 ? 'STOPPED' : status === 1 ? 'MOVING UP' : 'MOVING DOWN';
    const position = this.positionFromTime();
    const positionAsByte = getPositionAsByte(position);
    this.log.debug(
      `[Blind update] Saved position ${getPositionAsPerc(`${positionAsByte}`)}% (${positionAsByte})`
    );
    this.log.info(`[Blind update] Blind is now at position ${position} (status is ${statusDesc})`);
    switch (status) {
      case 0: // stopped
        this.blindStopped(positionAsByte, position);
        break;
      case 1: // going up
        this.blindGoingUp(positionAsByte, position);
        break;
      case 2: // going down
        this.blindGoingDown(positionAsByte, position);
        break;
    }
    this.log.info(
      `[Blind update] Status ${status}, state ${this.positionState}, ts ${this.lastCommandTime}`
    );
  }

  private blindGoingDown(positionAsByte: number, position: number) {
    const now = new Date().getTime();
    const Characteristic = this.platform.Characteristic;
    this.coveringService
      .getCharacteristic(Characteristic.PositionState)
      .updateValue(PositionState.DECREASING);
    if (this.lastCommandTime) {
      this.accessory.context = { ...this.device, position: positionAsByte };
      this.coveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(position);
    } else {
      this.log.info(
        `[Blind down] Blind was moved using physical button, lastCommandTime set to ${now}`
      );
      this.lastCommandTime = now; // external command (physical button)
    }
  }

  private blindGoingUp(positionAsByte: number, position: number) {
    const now = new Date().getTime();
    const Characteristic = this.platform.Characteristic;
    this.coveringService
      .getCharacteristic(Characteristic.PositionState)
      .updateValue(PositionState.INCREASING);
    if (this.lastCommandTime) {
      this.accessory.context = { ...this.device, position: positionAsByte };
      this.coveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(position);
    } else {
      this.log.info(
        `[Blind up] Blind was moved using physical button, lastCommandTime set to ${now}`
      );
      this.lastCommandTime = now; // external command (physical button)
    }
  }

  private blindStopped(positionAsByte: number, position: number) {
    const Characteristic = this.platform.Characteristic;
    this.coveringService
      .getCharacteristic(Characteristic.PositionState)
      .updateValue(PositionState.STOPPED);
    if (this.lastCommandTime) {
      this.accessory.context = { ...this.device, position: positionAsByte };
      this.lastCommandTime = 0;
      this.coveringService.getCharacteristic(Characteristic.TargetPosition).updateValue(position);
      this.coveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(position);
    } else {
      this.log.info(`[Blind stop] Blind was moved using physical button, lastCommandTime set to 0`);
      this.lastCommandTime = 0;
    }
  }

  protected getPositionFromDeviceData(): number {
    return this.positionFromTime();
  }

  protected getPositionStateFromDeviceData(): number {
    const status = parseInt(this.device.status || '0'); // can be 1 (increasing), 2 (decreasing) or 0 (stopped)
    switch (status) {
      case 1:
        return PositionState.INCREASING;
      case 0:
        return PositionState.STOPPED;
      case 2:
        return PositionState.DECREASING;
    }
  }

  private positionFromTime() {
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
        `[Position from time] Current position ${currentPosition}, delta is ${delta}ms (${deltaPercentage}%). State ${this.positionState}`
      );
      if (this.positionState === PositionState.DECREASING) {
        // Blind is decreasing, subtract the delta
        return Math.max(Blind.CLOSED, currentPosition - deltaPercentage);
      }
      // Blind is increasing, add the delta
      return Math.min(StandardBlind.OPEN, currentPosition + deltaPercentage);
    }
    return StandardBlind.OPEN;
  }
}
