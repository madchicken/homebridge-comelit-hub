import { ComelitAccessory } from './comelit';
import {
  ClimaMode,
  ClimaOnOff,
  ComelitClient,
  STATUS_ON,
  ThermostatDeviceData,
} from 'comelit-client';
import client from 'prom-client';
import { ComelitPlatform } from '../comelit-platform';
import {
  CharacteristicEventTypes,
  CharacteristicSetCallback,
  PlatformAccessory,
  Service,
  VoidCallback,
} from 'homebridge';
import {
  Active,
  CurrentHumidifierDehumidifierState,
  TargetHumidifierDehumidifierState,
} from './hap';

const dehumidifierStatus = new client.Gauge({
  name: 'comelit_dehumidifier_status',
  help: 'Dehumidifier on/off',
  labelNames: ['dehumidifier_name'],
});
const dehumidifierHumidity = new client.Gauge({
  name: 'comelit_dehumidifier_humidity',
  help: 'Dehumidifier humidity',
  labelNames: ['dehumidifier_name'],
});

export class Dehumidifier extends ComelitAccessory<ThermostatDeviceData> {
  private dehumidifierService: Service;

  constructor(platform: ComelitPlatform, accessory: PlatformAccessory, client: ComelitClient) {
    super(platform, accessory, client);
  }

  protected initServices(): Service[] {
    const Characteristic = this.platform.Characteristic;
    const accessoryInformation = this.initAccessoryInformation();
    this.dehumidifierService =
      this.accessory.getService(this.platform.Service.HumidifierDehumidifier) ||
      this.accessory.addService(this.platform.Service.HumidifierDehumidifier);

    this.dehumidifierService.addOptionalCharacteristic(
      Characteristic.RelativeHumidityDehumidifierThreshold
    );
    this.dehumidifierService.addOptionalCharacteristic(
      Characteristic.RelativeHumidityHumidifierThreshold
    );
    this.dehumidifierService.addOptionalCharacteristic(Characteristic.Active);
    this.update(this.device);

    this.dehumidifierService
      .getCharacteristic(Characteristic.RelativeHumidityDehumidifierThreshold)
      .on(CharacteristicEventTypes.SET, async (humidity: number, callback: VoidCallback) => {
        try {
          this.log.info(
            `Modifying target humidity threshold of ${this.accessory.displayName}-dehumidifier to ${humidity}%`
          );
          await this.client.setHumidity(this.device.id, humidity);
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
          this.log.info(
            `Modifying target state of ${this.accessory.displayName}-dehumidifier to ${state}`
          );
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
      .on(
        CharacteristicEventTypes.SET,
        async (state: number, callback: CharacteristicSetCallback) => {
          try {
            this.log.info(
              `Modifying active state of ${this.accessory.displayName}-dehumidifier to ${state}`
            );
            switch (state) {
              case Active.ACTIVE:
                await this.client.switchHumidifierMode(this.device.id, ClimaMode.MANUAL);
                break;
              case Active.INACTIVE:
                await this.client.toggleHumidifierStatus(this.device.id, ClimaOnOff.OFF_HUMI);
                break;
            }
            callback();
          } catch (e) {
            callback(e);
          }
        }
      );

    return [accessoryInformation, this.dehumidifierService];
  }

  public update(data: ThermostatDeviceData): void {
    const Characteristic = this.platform.Characteristic;
    const auto_man = data.auto_man_umi;
    const isOff = auto_man === ClimaMode.OFF_AUTO || auto_man === ClimaMode.OFF_MANUAL;
    const isOn = auto_man === ClimaMode.AUTO || auto_man === ClimaMode.MANUAL;
    const isAuto = auto_man === ClimaMode.OFF_AUTO || auto_man === ClimaMode.AUTO;
    const isWorking = isOn && data.status === STATUS_ON;

    this.log.info(
      `Dehumidifier status is ${isOff ? 'OFF' : 'ON'}, ${
        isAuto ? 'auto mode' : 'manual mode'
      }, Humidity level ${parseInt(data.umidita)}%, threshold ${
        data.soglia_attiva_umi
      }%\nGeneral status is ${data.status === '1' ? 'ON' : 'OFF'}`
    );

    this.dehumidifierService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .updateValue(parseInt(data.umidita));
    this.dehumidifierService
      .getCharacteristic(Characteristic.RelativeHumidityHumidifierThreshold)
      .updateValue(parseInt(data.umidita));
    this.dehumidifierService
      .getCharacteristic(Characteristic.RelativeHumidityDehumidifierThreshold)
      .updateValue(parseInt(data.soglia_attiva_umi));
    this.dehumidifierService
      .getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState)
      .updateValue(
        isOff
          ? CurrentHumidifierDehumidifierState.INACTIVE
          : isWorking
          ? CurrentHumidifierDehumidifierState.DEHUMIDIFYING
          : CurrentHumidifierDehumidifierState.IDLE
      );
    this.dehumidifierService
      .getCharacteristic(Characteristic.TargetHumidifierDehumidifierState)
      .updateValue(TargetHumidifierDehumidifierState.DEHUMIDIFIER);
    this.dehumidifierService
      .getCharacteristic(Characteristic.Active)
      .updateValue(isOn ? Active.ACTIVE : Active.INACTIVE);

    dehumidifierStatus.set({ dehumidifier_name: data.descrizione }, isWorking ? 0 : 1);
    dehumidifierHumidity.set({ dehumidifier_name: data.descrizione }, parseInt(data.umidita));
  }
}
