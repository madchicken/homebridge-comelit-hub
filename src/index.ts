import { ComelitPlatform } from './comelit-platform';
import { API, Formats, Perms, Units, Service, Characteristic, PlatformAccessory } from 'homebridge';
import fakegato from 'fakegato-history';
import { Fakegato } from './types';

interface ExtraHAPTypes {
  Service: typeof Service;
  Characteristic: typeof Characteristic;
  PlatformAccessory: typeof PlatformAccessory;
  CurrentPowerConsumption: Characteristic;
  TotalConsumption: Characteristic;
  PowerMeterService: Service;
  FakeGatoHistoryService: Fakegato;
}

export let HomebridgeAPI: API;
export const HAP: ExtraHAPTypes = {
  Service: null,
  Characteristic: null,
  PlatformAccessory: null,
  CurrentPowerConsumption: null,
  TotalConsumption: null,
  PowerMeterService: null,
  FakeGatoHistoryService: null,
};

export default function(homebridge: API) {
  HomebridgeAPI = homebridge;
  HAP.Service = homebridge.hap.Service;
  HAP.Characteristic = homebridge.hap.Characteristic;
  HAP.PlatformAccessory = homebridge.platformAccessory;

  HAP.FakeGatoHistoryService = fakegato(homebridge);

  homebridge.registerPlatform('Comelit', ComelitPlatform);
}
