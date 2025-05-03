import {
  API,
  APIEvent,
  Categories,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';
import {
  BlindDeviceData,
  ComelitClient,
  DeviceData, DoorDeviceData,
  HomeIndex,
  OBJECT_SUBTYPE,
  ROOT_ID,
} from 'comelit-client';
import express, { Express } from 'express';
import client, { register } from 'prom-client';
import * as http from 'http';
import { ComelitAccessory } from './accessories/comelit';
import { Lightbulb } from './accessories/lightbulb';
import { Thermostat } from './accessories/thermostat';
import { Outlet } from './accessories/outlet';
import { PowerSupplier } from './accessories/power-supplier';
import { Other } from './accessories/other';
import { Irrigation } from './accessories/irrigation';
import { EnhancedBlind } from './accessories/enhanced-blind';
import { StandardBlind } from './accessories/standard-blind';
import Timeout = NodeJS.Timeout;
import { Blind } from './accessories/blind';
import { DoorAccessory } from './accessories/door-accessory';
import { DoorDeviceConfig } from './types';
import { Doorbell } from './accessories/doorbell';

export interface HubConfig extends PlatformConfig {
  username: string;
  password: string;
  hub_username: string;
  hub_password: string;
  broker_url?: string;
  client_id?: string;
  export_prometheus_metrics?: boolean;
  exporter_http_port?: number;
  blind_opening_time?: number;
  blind_closing_time?: number;
  use_comelit_blind_timing?: boolean;
  keep_alive?: number;
  avoid_duplicates?: boolean;
  hide_lights?: boolean;
  hide_blinds?: boolean;
  hide_thermostats?: boolean;
  hide_power_suppliers?: boolean;
  hide_outlets?: boolean;
  hide_others?: boolean;
  hide_irrigation?: boolean;
  hide_doors?: boolean;
  hide_vip?: boolean;
  door_devices?: DoorDeviceConfig[];
}

const uptime = new client.Gauge({
  name: 'comelit_uptime',
  help: 'Client client uptime',
});

const DEFAULT_HTTP_PORT = 3002;
const expr: Express = express();
expr.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (e) {
    res.status(500).end(e.message);
  }
});

const MIN_OPEN_CLOSE_TIME = 20;
const MAX_OPEN_CLOSE_TIME = 80;

export class ComelitPlatform implements DynamicPlatformPlugin {
  static KEEP_ALIVE_TIMEOUT = 120000;

  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly PlatformAccessory: typeof PlatformAccessory;

  public mappedAccessories: Map<string, ComelitAccessory<DeviceData>> = new Map<
    string,
    ComelitAccessory<DeviceData>
  >();

  readonly log: Logger;
  public readonly accessories: PlatformAccessory[] = [];
  readonly homebridge: API;
  private client: ComelitClient;
  readonly config: HubConfig;
  private keepAliveTimer: Timeout;
  private server: http.Server;
  private mappedNames: { [key: string]: boolean };

  constructor(log: Logger, config: HubConfig, api: API) {
    this.log = log;
    this.log.info('Initializing platform: ', config);
    this.config = config;
    // Save the API object as plugin needs to register new accessory via this object
    this.homebridge = api;
    this.log.info(`homebridge API version: ${api.version}`);
    this.Service = this.homebridge.hap.Service;
    this.Characteristic = this.homebridge.hap.Characteristic;
    this.PlatformAccessory = this.homebridge.platformAccessory;
    this.homebridge.on(APIEvent.DID_FINISH_LAUNCHING, () => this.discoverDevices());
    this.homebridge.on(APIEvent.SHUTDOWN, () => this.shutdown());
  }

  async discoverDevices() {
    this.mappedNames = {};
    await this.login();
    this.log.info('Building accessories list...');
    const homeIndex = await this.client.fetchHomeIndex();
    if (this.config.hide_lights !== true) {
      this.mapLights(homeIndex);
    }
    if (this.config.hide_thermostats !== true) {
      this.mapThermostats(homeIndex);
    }
    if (this.config.hide_blinds !== true) {
      this.mapBlinds(homeIndex);
    }
    if (this.config.hide_outlets !== true) {
      this.mapOutlets(homeIndex);
    }
    if (this.config.hide_power_suppliers !== true) {
      this.mapSuppliers(homeIndex);
    }
    if (this.config.hide_others !== true) {
      this.mapOthers(homeIndex);
    }
    if (this.config.hide_irrigation !== true) {
      this.mapIrrigation(homeIndex);
    }
    if (this.config.hide_doors !== true) {
      this.mapDoors(homeIndex);
    }
    if (this.config.hide_vip !== true) {
      this.mapVip(homeIndex);
    }
    this.log.info(`Found ${this.mappedAccessories.size} accessories`);
    this.log.info('Subscribed to root object');
    if (homeIndex.unknownIndex.size) {
      homeIndex.unknownIndex.forEach((value, key) =>
        this.log.warn(`Unknown device found ${key}:`, value)
      );
    }
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  getDeviceName(deviceData: DeviceData): string {
    let key = deviceData.descrizione;
    if (this.config.avoid_duplicates) {
      let index = 0;
      while (this.mappedNames[key] !== undefined) {
        index++;
        key = `${deviceData.descrizione} (${index})`;
      }
      this.mappedNames[key] = true;
    }
    return key;
  }

  updateAccessory<T extends DeviceData>(id: string, data: T) {
    try {
      const comelitAccessory = this.mappedAccessories.get(id);
      if (comelitAccessory) {
        comelitAccessory.updateDevice(data);
      }
    } catch (e) {
      this.log.error(e.message);
    }
  }

  keepAlive() {
    this.keepAliveTimer = setTimeout(async () => {
      try {
        await this.client.ping();
        uptime.set(1);
        this.keepAlive();
      } catch (e) {
        this.log.error(e);
        await this.loginWithRetry();
      }
    }, this.config.keep_alive || ComelitPlatform.KEEP_ALIVE_TIMEOUT);
  }

  private mapSuppliers(homeIndex: HomeIndex) {
    const supplierIds = [...homeIndex.supplierIndex.keys()];
    this.log.info(`Found ${supplierIds.length} suppliers`);
    supplierIds.forEach(id => {
      const deviceData = homeIndex.supplierIndex.get(id);
      if (deviceData) {
        this.log.debug(`Supplier ID: ${id}, ${deviceData.descrizione}`);
        const accessory = this.createHapAccessory(deviceData, Categories.OTHER);
        this.mappedAccessories.set(id, new PowerSupplier(this, accessory, this.client));
      }
    });
  }

  private mapOutlets(homeIndex: HomeIndex) {
    const outletIds = [...homeIndex.outletsIndex.keys()];
    this.log.info(`Found ${outletIds.length} outlets`);
    outletIds.forEach(id => {
      const deviceData = homeIndex.outletsIndex.get(id);
      if (deviceData) {
        this.log.debug(`Outlet ID: ${id}, ${deviceData.descrizione}`);
        const accessory = this.createHapAccessory(deviceData, Categories.OUTLET);
        this.mappedAccessories.set(id, new Outlet(this, accessory, this.client));
      }
    });
  }

  private mapBlinds(homeIndex: HomeIndex) {
    const shadeIds = [...homeIndex.blindsIndex.keys()];
    this.log.info(`Found ${shadeIds.length} shades`);
    shadeIds.forEach(id => {
      const deviceData = homeIndex.blindsIndex.get(id);
      if (deviceData) {
        this.log.debug(`Blind ID: ${id}, ${deviceData.descrizione}`);
        const accessory = this.createHapAccessory(deviceData, Categories.WINDOW_COVERING);
        // Enhanced blinds are able to set the position while standard ones are not (and we simulate it)
        const isEnhanced = deviceData.sub_type === OBJECT_SUBTYPE.ENHANCED_ELECTRIC_BLIND;
        const openingTime = this.getOpeningTime(deviceData);
        const closingTime = this.getClosingTime(deviceData);
        this.mappedAccessories.set(
          id,
          isEnhanced
            ? new EnhancedBlind(this, accessory, this.client)
            : new StandardBlind(this, accessory, this.client, openingTime, closingTime)
        );
      }
    });
  }

  public getClosingTime(deviceData: BlindDeviceData) {
    try {
      return this.config.use_comelit_blind_timing
        ? Math.max(
            MAX_OPEN_CLOSE_TIME,
            Math.min(MIN_OPEN_CLOSE_TIME, parseInt(deviceData.closeTime))
          )
        : this.config.blind_closing_time;
    } catch (e) {
      return Blind.CLOSING_TIME;
    }
  }

  public getOpeningTime(deviceData: BlindDeviceData) {
    try {
      return this.config.use_comelit_blind_timing
        ? Math.max(
            MAX_OPEN_CLOSE_TIME,
            Math.min(MIN_OPEN_CLOSE_TIME, parseInt(deviceData.openTime))
          )
        : this.config.blind_opening_time;
    } catch (e) {
      return Blind.OPENING_TIME;
    }
  }

  private mapThermostats(homeIndex: HomeIndex) {
    const thermostatIds = [...homeIndex.thermostatsIndex.keys()];
    this.log.info(`Found ${thermostatIds.length} thermostats`);
    thermostatIds.forEach(id => {
      const deviceData = homeIndex.thermostatsIndex.get(id);
      if (deviceData) {
        this.log.debug(`Thermostat ID: ${id}, ${deviceData.descrizione}`);
        if (this.config.hide_thermostats !== true) {
          const accessory = this.createHapAccessory(deviceData, Categories.THERMOSTAT);
          this.mappedAccessories.set(id, new Thermostat(this, accessory, this.client));
        }
      }
    });
  }

  private mapLights(homeIndex: HomeIndex) {
    const lightIds = [...homeIndex.lightsIndex.keys()];
    this.log.info(`Found ${lightIds.length} lights`);

    lightIds.forEach(id => {
      const deviceData = homeIndex.lightsIndex.get(id);
      if (deviceData) {
        this.log.debug(`Light ID: ${id}, ${deviceData.descrizione}`);
        const accessory = this.createHapAccessory(deviceData, Categories.LIGHTBULB);
        this.mappedAccessories.set(id, new Lightbulb(this, accessory, this.client));
      }
    });
  }

  private mapOthers(homeIndex: HomeIndex) {
    const othersIds = [...homeIndex.othersIndex.keys()];
    this.log.info(`Found ${othersIds.length} other accessories`);

    othersIds.forEach(id => {
      const deviceData = homeIndex.othersIndex.get(id);
      if (deviceData) {
        this.log.debug(`Other ID: ${id}, ${deviceData.descrizione}`);
        const accessory = this.createHapAccessory(deviceData, Categories.SWITCH);
        this.mappedAccessories.set(id, new Other(this, accessory, this.client));
      }
    });
  }

  private mapIrrigation(homeIndex: HomeIndex) {
    const irrigationIds = [...homeIndex.irrigationIndex.keys()];
    this.log.info(`Found ${irrigationIds.length} irrigation`);

    irrigationIds.forEach(id => {
      const deviceData = homeIndex.irrigationIndex.get(id);
      if (deviceData) {
        this.log.debug(`Irrigation ID: ${id}, ${deviceData.descrizione}`);
        const accessory = this.createHapAccessory(deviceData, Categories.SPRINKLER);
        this.mappedAccessories.set(id, new Irrigation(this, accessory, this.client));
      }
    });
  }

  private mapDoors(homeIndex: HomeIndex) {
    const doorIds = [...homeIndex.doorIndex.keys()];
    this.log.info(`Found ${doorIds.length} doors`);

    doorIds.forEach(id => {
      const deviceData: DeviceData<DoorDeviceData> = homeIndex.doorIndex.get(id);
      if (deviceData) {
        this.log.debug(`Door ID: ${id}, ${deviceData.descrizione}`);
        const accessory = this.createHapAccessory(deviceData, Categories.DOOR_LOCK);
        this.mappedAccessories.set(
          id,
          new DoorAccessory(
            this,
            accessory,
            this.client
          )
        );
      }
    });
  }

  private mapVip(homeIndex: HomeIndex) {
    const vipIds = [...homeIndex.vipIndex.keys()];
    this.log.info(`Found ${vipIds.length} vip elements`);

    vipIds.forEach(id => {
      const deviceData = homeIndex.vipIndex.get(id);
      if (deviceData) {
        this.log.debug(`VIP ID: ${id}, ${deviceData.descrizione}`);
        const accessory = this.createHapAccessory(deviceData, Categories.VIDEO_DOORBELL);
        this.mappedAccessories.set(id, new Doorbell(this, accessory, this.client));
      }
    });
  }

  public createHapAccessory(deviceData: DeviceData, category: Categories, id?: string) {
    const uuid = this.homebridge.hap.uuid.generate(id || deviceData.id);
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
    const accessory =
      existingAccessory ||
      new this.PlatformAccessory(this.getDeviceName(deviceData), uuid, category);
    accessory.context = deviceData;
    if (existingAccessory) {
      this.log.debug(`Reuse accessory from cache with uuid ${uuid} of type ${category}`);
    } else {
      this.log.debug(`Registering new accessory with uuid ${uuid} of type ${category}`);
      this.homebridge.registerPlatformAccessories('homebridge-comelit-platform', 'Comelit', [
        accessory,
      ]);
    }
    return accessory;
  }

  private async loginWithRetry() {
    uptime.set(0);
    const logged = await this.login();
    while (!logged) {
      setTimeout(() => this.loginWithRetry(), 5000);
    }
  }

  private async login(): Promise<boolean> {
    try {
      await this.shutdown();
      this.log.info('Creating MQTT client and logging in...');
      this.client = this.client || new ComelitClient(this.updateAccessory.bind(this), this.log);
      await this.client.init({
        host: this.config.broker_url,
        username: this.config.username,
        password: this.config.password,
        hub_username: this.config.hub_username,
        hub_password: this.config.hub_password,
        clientId: this.config.client_id,
      });
      if (!this.server && this.config.export_prometheus_metrics) {
        this.server = expr.listen(this.config.exporter_http_port || DEFAULT_HTTP_PORT);
      }
    } catch (e) {
      this.log.error('Error initializing MQTT client', e);
      return false;
    }

    try {
      await this.client.login();
      await this.client.subscribeObject(ROOT_ID);
      this.keepAlive();
      return true;
    } catch (e) {
      this.log.error('Error logging in', e);
      return false;
    }
  }

  private async shutdown() {
    if (this.client) {
      this.log.info('Shutting down MQTT client...');
      if (this.keepAliveTimer) {
        clearTimeout(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }
      await this.client.shutdown();
    }
  }
}
