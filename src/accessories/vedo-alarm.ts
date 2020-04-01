import {
  Callback,
  Categories,
  Characteristic,
  CharacteristicEventTypes,
  Service,
} from 'hap-nodejs';
import { HomebridgeAPI } from '../index';
import { AlarmArea, VedoClient } from 'comelit-client';
import {
  SecuritySystemCurrentState,
  SecuritySystemTargetState,
} from 'hap-nodejs/dist/lib/gen/HomeKit';
import Timeout = NodeJS.Timeout;

const DEFAULT_ALARM_CHECK_TIMEOUT = 5000;

export class VedoAlarm {
  private readonly address: string;
  private readonly code: string;
  private readonly client: VedoClient;
  readonly log: Function;
  readonly name: string;
  readonly category: Categories;
  private securityService: Service;
  private timeout: Timeout;
  private readonly checkFrequency: number;
  private lastUID: string;

  constructor(
    log: Function,
    address: string,
    code: string,
    checkFrequency: number = DEFAULT_ALARM_CHECK_TIMEOUT
  ) {
    this.log = (str: string) => log(`[Vedo Alarm] ${str}`);
    this.address = address;
    this.code = code;
    this.name = 'Vedo Alarm @ ' + address;
    this.category = Categories.SECURITY_SYSTEM;
    this.checkFrequency = checkFrequency;
    this.client = new VedoClient(this.address);
  }

  getServices(): Service[] {
    const accessoryInformation = new HomebridgeAPI.hap.Service.AccessoryInformation(null, null);
    accessoryInformation
      .setCharacteristic(Characteristic.Name, 'Vedo Alarm')
      .setCharacteristic(Characteristic.Manufacturer, 'Comelit')
      .setCharacteristic(Characteristic.Model, 'None')
      .setCharacteristic(Characteristic.FirmwareRevision, 'None')
      .setCharacteristic(Characteristic.SerialNumber, 'None');

    this.securityService = new HomebridgeAPI.hap.Service.SecuritySystem('Vedo Alarm', null);
    this.securityService
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .setValue(SecuritySystemCurrentState.DISARMED);
    this.securityService
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .setValue(SecuritySystemTargetState.DISARM);

    this.securityService
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .on(CharacteristicEventTypes.GET, async (callback: Callback) => {
        try {
          const uid = await this.client.loginWithRetry(this.code);
          const alarmAreas = await this.client.findActiveAreas(uid);
          const armed = alarmAreas.reduce(
            (armed: boolean, area: AlarmArea) => armed || area.armed,
            false
          );
          const trigger = alarmAreas.reduce(
            (armed: boolean, area: AlarmArea) => armed || area.triggered,
            false
          );
          if (trigger) {
            callback(null, SecuritySystemCurrentState.ALARM_TRIGGERED);
          } else {
            callback(
              null,
              armed ? SecuritySystemCurrentState.AWAY_ARM : SecuritySystemCurrentState.DISARMED
            );
          }
        } catch (e) {
          callback(e.message);
        }
      });

    this.securityService
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .on(CharacteristicEventTypes.SET, async (value: number, callback: Callback) => {
        try {
          const uid = await this.client.loginWithRetry(this.code);
          if (uid) {
            if (value === SecuritySystemTargetState.DISARM) {
              this.log('Disarming system');
              await this.client.disarm(uid, 32);
              callback();
            } else {
              this.log('Arming system');
              await this.client.arm(uid, 32);
              callback();
            }
          } else {
            callback(new Error('Cannot login into system'));
          }
        } catch (e) {
          callback(e);
        }
      });

    this.timeout = setTimeout(async () => {
      this.checkAlarm();
    }, this.checkFrequency);

    return [accessoryInformation, this.securityService];
  }

  update(alarmAreas: AlarmArea[]) {
    const status = alarmAreas.reduce(
      (armed: boolean, area: AlarmArea) => armed || area.armed,
      false
    );
    this.log(`Alarm status is ${status}`);
    const trigger = alarmAreas.reduce(
      (armed: boolean, area: AlarmArea) => armed || area.triggered,
      false
    );
    this.log(`Alarm trigger is ${status}`);
    if (trigger) {
      this.securityService
        .getCharacteristic(Characteristic.SecuritySystemCurrentState)
        .updateValue(SecuritySystemCurrentState.ALARM_TRIGGERED);
    } else {
      this.securityService
        .getCharacteristic(Characteristic.SecuritySystemCurrentState)
        .updateValue(
          status ? SecuritySystemCurrentState.STAY_ARM : SecuritySystemCurrentState.DISARMED
        );
    }
  }

  private async checkAlarm() {
    try {
      const uid = this.lastUID || (await this.client.loginWithRetry(this.code));
      if (uid) {
        this.lastUID = uid;
        const alarmAreas = await this.client.findActiveAreas(uid);
        this.update(alarmAreas);
      }
    } catch (e) {
      this.lastUID = null;
      this.log(e.message);
    }
    this.timeout.refresh();
  }
}
