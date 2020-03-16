import { ComelitAccessory } from "./comelit";
import {
  ClimaMode,
  ComelitClient,
  OBJECT_SUBTYPE,
  ThermoSeason,
  ThermostatDeviceData
} from "comelit-client";
import {
  Categories,
  Characteristic,
  CharacteristicEventTypes,
  Service,
  VoidCallback
} from "hap-nodejs";
import { HomebridgeAPI } from "../index";
import {
  Active,
  CurrentHeatingCoolingState,
  CurrentHumidifierDehumidifierState,
  TargetHeatingCoolingState,
  TargetHumidifierDehumidifierState,
  TemperatureDisplayUnits
} from "hap-nodejs/dist/lib/gen/HomeKit";
import client from "prom-client";

const thermostatStatus = new client.Gauge({
  name: "comelit_thermostat_status",
  help: "Thermostat on/off",
  labelNames: ["thermostat_name"]
});
const thermostatTemperature = new client.Gauge({
  name: "comelit_thermostat_temperature",
  help: "Thermostat temperature",
  labelNames: ["thermostat_name"]
});

export class Thermostat extends ComelitAccessory<ThermostatDeviceData> {
  static readonly ON = "1";
  static readonly DEHUMIDIFIER_ON = "6";
  static readonly OFF = "0";
  static readonly AUTO_MODE = "2";

  private thermostatService: Service;
  private dehumidifierService: Service;

  constructor(
    log: Function,
    device: ThermostatDeviceData,
    name: string,
    client: ComelitClient
  ) {
    super(log, device, name, client, Categories.THERMOSTAT);
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation();
    const isDehumidifier =
      this.device.sub_type === OBJECT_SUBTYPE.THERMOSTAT_DEHUMIDIFIER;

    this.thermostatService = new HomebridgeAPI.hap.Service.Thermostat(
      this.device.descrizione,
      null
    );
    if (isDehumidifier) {
      this.dehumidifierService = new HomebridgeAPI.hap.Service.HumidifierDehumidifier(
        this.device.descrizione,
        null
      );
    }
    this.update(this.device);

    this.thermostatService
      .getCharacteristic(Characteristic.TargetTemperature)
      .on(
        CharacteristicEventTypes.SET,
        async (temperature: number, callback: VoidCallback) => {
          try {
            const normalizedTemp = temperature * 10;
            await this.client.setTemperature(this.device.id, normalizedTemp);
            this.device.temperatura = `${normalizedTemp}`;
            callback();
          } catch (e) {
            callback(e);
          }
        }
      );

    this.thermostatService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on(
        CharacteristicEventTypes.SET,
        async (state: number, callback: VoidCallback) => {
          try {
            this.log(`Modifying state of ${this.name} to ${state}`);
            callback();
          } catch (e) {
            callback(e);
          }
        }
      );

    return isDehumidifier
      ? [accessoryInformation, this.thermostatService, this.dehumidifierService]
      : [accessoryInformation, this.thermostatService];
  }

  public update(data: ThermostatDeviceData): void {
    const status = parseInt(data.status);
    const isOff: boolean =
      data.auto_man === ClimaMode.OFF_AUTO ||
      data.auto_man === ClimaMode.OFF_MANUAL;
    const isAuto: boolean = data.auto_man === ClimaMode.AUTO;
    this.log(`Thermostat ${this.name} auto mode is ${isAuto}, off ${isOff}`);
    const isSummer = data.est_inv === ThermoSeason.SUMMER;

    const heatingCollingState = isOff
      ? CurrentHeatingCoolingState.OFF
      : isSummer
      ? CurrentHeatingCoolingState.COOL
      : CurrentHeatingCoolingState.HEAT;
    this.thermostatService
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .updateValue(heatingCollingState);
    this.thermostatService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .updateValue(
        isAuto
          ? TargetHeatingCoolingState.AUTO
          : isOff
          ? TargetHeatingCoolingState.OFF
          : heatingCollingState
      );

    const temperature = data.temperatura
      ? parseFloat(data.temperatura) / 10
      : 0;
    this.log(`Temperature for ${this.name} is ${temperature}`);
    this.thermostatService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .updateValue(temperature);

    const activeThreshold = isSummer
      ? data.soglia_attiva_umi
      : data.soglia_attiva;
    const targetTemperature = activeThreshold
      ? parseFloat(activeThreshold) / 10
      : 0;
    this.log(`Threshold for ${this.name} is ${targetTemperature}`);
    this.thermostatService
      .getCharacteristic(Characteristic.TargetTemperature)
      .updateValue(targetTemperature);
    this.thermostatService
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .updateValue(TemperatureDisplayUnits.CELSIUS);

    thermostatStatus.set({ thermostat_name: data.descrizione }, status);
    thermostatTemperature.set(
      { thermostat_name: data.descrizione },
      temperature
    );

    if (data.sub_type === OBJECT_SUBTYPE.THERMOSTAT_DEHUMIDIFIER) {
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
}
