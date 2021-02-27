import { ComelitPlatform } from './comelit-platform';
import { API, Formats, Perms, Units } from 'homebridge';
import fakegato from 'fakegato-history';

export let HomebridgeAPI: API;
export const HAP = {
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

  HAP.CurrentPowerConsumption = class CurrentPowerConsumption extends HAP.Characteristic {
    public static readonly UUID: String = 'E863F10D-079E-48FF-8F27-9C2605A29F52';

    constructor() {
      super('Current power consumption', HAP.CurrentPowerConsumption.UUID, {
        format: Formats.UINT16,
        unit: 'watts' as Units, // ??
        maxValue: 100000,
        minValue: 0,
        minStep: 1,
        perms: [Perms.PAIRED_READ, Perms.NOTIFY],
      });
    }
  };

  HAP.TotalConsumption = class TotalConsumption extends HAP.Characteristic {
    public static readonly UUID: String = 'E863F10C-079E-48FF-8F27-9C2605A29F52';

    constructor() {
      super('Current power consumption', HAP.CurrentPowerConsumption.UUID, {
        format: Formats.FLOAT,
        unit: 'kWh' as Units, // ??
        minValue: 0,
        minStep: 0.001,
        perms: [Perms.PAIRED_READ, Perms.NOTIFY],
      });
    }
  };

  HAP.PowerMeterService = class PowerMeterService extends HAP.Service {
    public static readonly UUID: String = '00000001-0000-1777-8000-775D67EC4377';

    constructor(displayName?: string) {
      super(displayName, HAP.PowerMeterService.UUID);
      this.addCharacteristic(HAP.CurrentPowerConsumption);
      this.addCharacteristic(HAP.TotalConsumption);
    }
  };

  HAP.FakeGatoHistoryService = fakegato(homebridge);

  homebridge.registerPlatform('Comelit', ComelitPlatform);
}
