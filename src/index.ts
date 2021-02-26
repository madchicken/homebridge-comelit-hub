import { ComelitPlatform } from './comelit-platform';
import { API, Formats, Perms, Units } from 'homebridge';
import fakegato from 'fakegato-history';

export let HomebridgeAPI: API;
export const HAP = {
  Service: null,
  Characteristic: null,
  PlatformAccessory: null,
  CurrentPowerConsumption: null,
  PowerMeterService: null,
  FakeGatoHistoryService: null,
};

export default function(homebridge: API) {
  HomebridgeAPI = homebridge;
  HAP.Service = homebridge.hap.Service;
  HAP.Characteristic = homebridge.hap.Characteristic;
  HAP.PlatformAccessory = homebridge.platformAccessory;

  HAP.CurrentPowerConsumption = class CurrentPowerConsumption extends HAP.Characteristic {
    constructor() {
      super('Current power consumption', 'E863F10D-079E-48FF-8F27-9C2605A29F52', {
        format: Formats.UINT16,
        unit: 'watts' as Units, // ??
        maxValue: 100000,
        minValue: 0,
        minStep: 1,
        perms: [Perms.PAIRED_READ, Perms.NOTIFY],
      });
    }
  };

  HAP.PowerMeterService = class PowerMeterService extends HAP.Service {
    constructor(displayName: string, UUID: string, subtype?: string | undefined) {
      super('Power meter service', '00000001-0000-1777-8000-775D67EC4377', subtype);
    }
  };

  HAP.FakeGatoHistoryService = fakegato(homebridge);

  homebridge.registerPlatform('Comelit', ComelitPlatform);
}
