import { ComelitAccessory } from './comelit';
import { BlindDeviceData, ComelitClient, ObjectStatus } from 'comelit-client';
import { Callback, Characteristic, CharacteristicEventTypes, Service } from 'hap-nodejs';
import { HomebridgeAPI } from '../index';
import { PositionState } from 'hap-nodejs/dist/lib/gen/HomeKit';
import { ComelitPlatform } from '../comelit-platform';
import { PlatformAccessory } from 'homebridge';
import Timeout = NodeJS.Timeout;

export class Blind extends ComelitAccessory<BlindDeviceData> {
  static readonly OPEN = 100;
  static readonly CLOSED = 0;

  static readonly OPENING_CLOSING_TIME = 35; // 35 seconds to open approx. We should have this in the config

  private coveringService: Service;
  private timeout: Timeout;
  private lastCommandTime: number;
  private readonly closingTime: number;
  private positionState: number;

  constructor(
    platform: ComelitPlatform,
    accessory: PlatformAccessory,
    client: ComelitClient,
    closingTime?: number
  ) {
    super(platform, accessory, client);
    this.closingTime = (closingTime || Blind.OPENING_CLOSING_TIME) * 1000;
    this.log.info(`Blind ${accessory.context.device.id} has closing time of ${this.closingTime}`);
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation();

    this.coveringService = new HomebridgeAPI.hap.Service.WindowCovering(
      this.device.descrizione,
      null
    );

    this.coveringService.setCharacteristic(Characteristic.PositionState, PositionState.STOPPED);
    this.coveringService.setCharacteristic(Characteristic.TargetPosition, Blind.OPEN);
    this.coveringService.setCharacteristic(Characteristic.CurrentPosition, Blind.OPEN);
    this.positionState = PositionState.STOPPED;

    this.coveringService
      .getCharacteristic(Characteristic.TargetPosition)
      .on(CharacteristicEventTypes.SET, async (position: number, callback: Callback) => {
        try {
          if (this.timeout) {
            await this.resetTimeout();
            callback();
            return;
          }

          const currentPosition = this.coveringService.getCharacteristic(
            Characteristic.CurrentPosition
          ).value as number;
          const status = position < currentPosition ? ObjectStatus.OFF : ObjectStatus.ON;
          const delta = currentPosition - position;
          this.log.info(
            `Setting position to ${position}%. Current position is ${currentPosition}. Delta is ${delta}`
          );
          if (delta !== 0) {
            await this.client.toggleDeviceStatus(this.device.id, status);
            this.lastCommandTime = new Date().getTime();
            this.timeout = setTimeout(async () => {
              this.resetTimeout();
            }, (this.closingTime * Math.abs(delta)) / 100);
          }
          callback();
        } catch (e) {
          callback(e);
        }
      });

    return [accessoryInformation, this.coveringService];
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
    const status = parseInt(data.status);
    const now = new Date().getTime();
    switch (status) {
      case ObjectStatus.ON:
        this.lastCommandTime = now;
        this.positionState = PositionState.INCREASING;
        break;
      case ObjectStatus.OFF: {
        const position = this.positionFromTime();
        this.lastCommandTime = 0;
        this.log.info(
          `Blind is now at position ${position} (it was ${
            this.positionState === PositionState.DECREASING ? 'going down' : 'going up'
          })`
        );
        this.positionState = PositionState.STOPPED;
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
        this.positionState = PositionState.DECREASING;
        break;
    }
    this.log.info(
      `Blind update: status ${status}, state ${this.positionState}, ts ${this.lastCommandTime}`
    );
  }

  private positionFromTime() {
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
