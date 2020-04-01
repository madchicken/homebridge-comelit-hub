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
    super(log, device, name, client, Categories.AIR_DEHUMIDIFIER);
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation();
    this.dehumidifierService = new HomebridgeAPI.hap.Service.HumidifierDehumidifier(
      this.device.descrizione,
      null
    );
    this.update(this.device);

    this.dehumidifierService
      .getCharacteristic(Characteristic.TargetTemperature)
      .on(CharacteristicEventTypes.SET, async (temperature: number, callback: VoidCallback) => {
        try {
          const normalizedTemp = temperature * 10;
          await this.client.setTemperature(this.device.id, normalizedTemp);
          this.device.temperatura = `${normalizedTemp}`;
          callback();
        } catch (e) {
          callback(e);
        }
      });

    this.dehumidifierService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on(CharacteristicEventTypes.SET, async (state: number, callback: VoidCallback) => {
        try {
          this.log(`Modifying state of ${this.name} to ${state}`);
          const currentState = this.device.auto_man;
          switch (state) {
            case TargetHeatingCoolingState.AUTO:
              await this.client.switchThermostatMode(this.device.id, ClimaMode.AUTO);
              break;
            case TargetHeatingCoolingState.COOL:
              await this.client.switchThermostatMode(this.device.id, ClimaMode.MANUAL);
              break;
            case TargetHeatingCoolingState.HEAT:
              await this.client.switchThermostatMode(this.device.id, ClimaMode.MANUAL);
              break;
            case TargetHeatingCoolingState.OFF:
              if (currentState === ClimaMode.AUTO) {
                await this.client.switchThermostatMode(this.device.id, ClimaMode.OFF_AUTO);
              } else if (currentState === ClimaMode.MANUAL) {
                await this.client.switchThermostatMode(this.device.id, ClimaMode.OFF_MANUAL);
              } else {
                await this.client.switchThermostatMode(this.device.id, ClimaMode.NONE);
              }
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
      data.auto_man === ClimaMode.OFF_AUTO || data.auto_man === ClimaMode.OFF_MANUAL;
    const isAuto: boolean = data.auto_man === ClimaMode.AUTO;
    this.log(`Thermostat ${this.name} auto mode is ${isAuto}, off ${isOff}`);

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
      .updateValue(TargetHumidifierDehumidifierState.DEHUMIDIFIER);
    this.dehumidifierService
      .getCharacteristic(Characteristic.Active)
      .updateValue(isDehumidifierOff ? Active.INACTIVE : Active.ACTIVE);
  }
}
