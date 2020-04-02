import { ComelitAccessory } from './comelit';
import { ClimaMode, ComelitClient, ThermostatDeviceData } from 'comelit-client';
import {
  Categories,
  Characteristic,
  CharacteristicEventTypes,
  Service,
  VoidCallback,
} from 'hap-nodejs';
import { HomebridgeAPI } from '../index';
import {
  Active,
  CurrentHumidifierDehumidifierState,
  TargetHeatingCoolingState,
  TargetHumidifierDehumidifierState,
} from 'hap-nodejs/dist/lib/gen/HomeKit';

export class Dehumidifier extends ComelitAccessory<ThermostatDeviceData> {
  private dehumidifierService: Service;

  constructor(log: Function, device: ThermostatDeviceData, name: string, client: ComelitClient) {
    super(log, device, name, client, Categories.AIR_CONDITIONER);
    this.uuid_base = `${device.objectId}#D`;
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation();
    this.dehumidifierService = new HomebridgeAPI.hap.Service.HumidifierDehumidifier(
      this.device.descrizione,
      null
    );
    this.dehumidifierService.addOptionalCharacteristic(
      Characteristic.RelativeHumidityDehumidifierThreshold
    );
    this.dehumidifierService.addOptionalCharacteristic(Characteristic.Active);
    this.update(this.device);

    this.dehumidifierService
      .getCharacteristic(Characteristic.RelativeHumidityDehumidifierThreshold)
      .on(CharacteristicEventTypes.SET, async (humidity: number, callback: VoidCallback) => {
        try {
          this.log(
            `Modifying target humidity threshold of ${this.name}-dehumidifier to ${humidity}%`
          );
          await this.client.setHumidifierTemperature(this.device.id, humidity);
          this.device.soglia_attiva_umi = `${humidity}`;
          callback();
        } catch (e) {
          callback(e);
        }
      });

    this.dehumidifierService
      .getCharacteristic(Characteristic.TargetHumidifierDehumidifierState)
      .on(CharacteristicEventTypes.SET, async (state: number, callback: VoidCallback) => {
        try {
          this.log(`Modifying target state of ${this.name}-dehumidifier to ${state}`);
          switch (state) {
            case TargetHumidifierDehumidifierState.DEHUMIDIFIER:
            case TargetHumidifierDehumidifierState.HUMIDIFIER:
              await this.client.switchHumidifierMode(this.device.id, ClimaMode.MANUAL);
              break;
            case TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER:
              await this.client.switchHumidifierMode(this.device.id, ClimaMode.AUTO);
              break;
          }
          callback();
        } catch (e) {
          callback(e);
        }
      });

    this.dehumidifierService
      .getCharacteristic(Characteristic.Active)
      .on(CharacteristicEventTypes.SET, async (state: number, callback: VoidCallback) => {
        try {
          this.log(`Modifying active state of ${this.name}-dehumidifier to ${state}`);
          switch (state) {
            case Active.ACTIVE:
              await this.client.switchHumidifierMode(this.device.id, ClimaMode.MANUAL);
              break;
            case Active.INACTIVE:
              await this.client.switchHumidifierMode(this.device.id, ClimaMode.OFF_MANUAL);
              break;
          }
          callback();
        } catch (e) {
          callback(e);
        }
      });
    return [accessoryInformation, this.dehumidifierService];
  }

  public update(data: ThermostatDeviceData): void {
    const isOff: boolean =
      data.auto_man_umi === ClimaMode.OFF_AUTO || data.auto_man_umi === ClimaMode.OFF_MANUAL;
    const isAuto: boolean = data.auto_man_umi === ClimaMode.AUTO;
    this.log(`Dehumidifier ${this.name} auto mode is ${isAuto}, off ${isOff}`);

    const isDehumidifierOff =
      data.auto_man_umi === ClimaMode.OFF_MANUAL ||
      data.auto_man_umi === ClimaMode.NONE ||
      data.auto_man_umi === ClimaMode.OFF_AUTO;
    const isDehumidifierAuto = data.auto_man_umi === ClimaMode.AUTO;

    this.dehumidifierService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .updateValue(parseInt(data.umidita));
    this.dehumidifierService
      .getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState)
      .updateValue(
        isDehumidifierOff
          ? CurrentHumidifierDehumidifierState.INACTIVE
          : isDehumidifierAuto
          ? CurrentHumidifierDehumidifierState.IDLE
          : CurrentHumidifierDehumidifierState.DEHUMIDIFYING
      );
    this.dehumidifierService
      .getCharacteristic(Characteristic.TargetHumidifierDehumidifierState)
      .updateValue(
        isDehumidifierAuto
          ? TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER
          : TargetHumidifierDehumidifierState.DEHUMIDIFIER
      );
    this.dehumidifierService
      .getCharacteristic(Characteristic.Active)
      .updateValue(isDehumidifierOff ? Active.INACTIVE : Active.ACTIVE);
  }
}
