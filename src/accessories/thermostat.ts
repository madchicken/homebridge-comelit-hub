import {ComelitAccessory} from "./comelit";
import {ComelitClient, ThermostatDeviceData} from "../comelit-client";
import {Categories, Characteristic, CharacteristicEventTypes, Service, VoidCallback} from "hap-nodejs";
import {HomebridgeAPI} from "../index";
import {
    Active,
    CurrentHeatingCoolingState, CurrentHumidifierDehumidifierState,
    TargetHeatingCoolingState, TargetHumidifierDehumidifierState,
    TemperatureDisplayUnits
} from "hap-nodejs/dist/lib/gen/HomeKit";

export class Thermostat extends ComelitAccessory<ThermostatDeviceData> {
    static readonly ON = '1';
    static readonly DEHUMIDIFIER_ON = '6';
    static readonly OFF = '0';
    static readonly AUTO_MODE = '2';

    private thermostatService: Service;
    private dehumidifierService: Service;

    constructor(log: Function, device: ThermostatDeviceData, name: string, client: ComelitClient) {
        super(log, device, name, client, Categories.THERMOSTAT);
    }

    protected initServices(): Service[] {
        const accessoryInformation = this.initAccessoryInformation();

        this.thermostatService = new HomebridgeAPI.hap.Service.Thermostat(this.device.descrizione, null);
        this.dehumidifierService = new HomebridgeAPI.hap.Service.HumidifierDehumidifier(this.device.descrizione, null);
        this.update(this.device);

        this.thermostatService
            .getCharacteristic(Characteristic.TargetTemperature)
            .on(CharacteristicEventTypes.SET, async (temperature: number, callback: VoidCallback) => {
                try {
                    await this.client.setTemperature(this.device.id, temperature);
                    this.device.temperatura = `${temperature * 10}`;
                    callback()
                } catch (e) {
                    callback(e);
                }
            });

        return [accessoryInformation, this.thermostatService, this.dehumidifierService];
    }

    public update(data: ThermostatDeviceData) {
        const isOff: boolean = data.status === Thermostat.OFF;
        const isAuto: boolean = data.auto_man === Thermostat.AUTO_MODE;
        this.log(`Thermostat auto mode is ${isAuto}`);
        const heatingCollingState = isOff ? CurrentHeatingCoolingState.OFF : data.est_inv === Thermostat.OFF ? CurrentHeatingCoolingState.COOL : CurrentHeatingCoolingState.HEAT;
        this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(heatingCollingState);
        this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(isAuto ? TargetHeatingCoolingState.AUTO : heatingCollingState);
        const temperature = data.temperatura ? parseFloat(data.temperatura) / 10 : 0;
        this.log(`Temperature for ${this.name} is ${temperature}`);
        this.thermostatService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(temperature);
        const targetTemperature = data.soglia_attiva ? parseFloat(data.soglia_attiva) / 10 : 0;
        this.log(`Threshold for ${this.name} is ${targetTemperature}`);
        this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(targetTemperature);
        this.thermostatService.getCharacteristic(Characteristic.TemperatureDisplayUnits).updateValue(TemperatureDisplayUnits.CELSIUS);

        const isDehumidifierOn = data.auto_man_umi === Thermostat.DEHUMIDIFIER_ON;
        this.dehumidifierService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(parseInt(data.umidita));
        this.dehumidifierService.getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState).updateValue(isDehumidifierOn ? CurrentHumidifierDehumidifierState.DEHUMIDIFYING : CurrentHumidifierDehumidifierState.INACTIVE);
        this.dehumidifierService.getCharacteristic(Characteristic.TargetHumidifierDehumidifierState).updateValue(TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER);
        this.dehumidifierService.getCharacteristic(Characteristic.Active).updateValue(isDehumidifierOn ? Active.ACTIVE : Active.INACTIVE);
        return temperature;
    }
}
