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
import { ComelitClient, DeviceData, HomeIndex, OBJECT_SUBTYPE, ROOT_ID } from 'comelit-client';
import express, { Express } from 'express';
import client, { register } from 'prom-client';
import * as http from 'http';
import { ComelitAccessory } from './accessories/comelit';
import { Lightbulb } from './accessories/lightbulb';
import { Thermostat } from './accessories/thermostat';
import { Blind } from './accessories/blind';
import { Outlet } from './accessories/outlet';
import { PowerSupplier } from './accessories/power-supplier';
import { Dehumidifier } from './accessories/dehumidifier';
import Timeout = NodeJS.Timeout;

const Sentry = require('@sentry/node');

export interface HubConfig extends PlatformConfig {
  username: string;
  password: string;
  hub_username: string;
  hub_password: string;
  broker_url?: string;
  client_id?: string;
  export_prometheus_metrics?: boolean;
  exporter_http_port?: number;
  sentry_dsn?: string;
  blind_closing_time?: number;
  keep_alive?: number;
  avoid_duplicates?: boolean;
  hide_lights?: boolean;
  hide_blinds?: boolean;
  hide_thermostats?: boolean;
  hide_dehumidifiers?: boolean;
  hide_power_suppliers?: boolean;
  hide_outlets?: boolean;
}

const uptime = new client.Gauge({
  name: 'comelit_uptime',
  help: 'Client client uptime',
});

const DEFAULT_HTTP_PORT = 3002;
const expr: Express = express();
expr.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});

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
  private readonly api: API;
  private client: ComelitClient;
  private readonly config: HubConfig;
  private keepAliveTimer: Timeout;
  private server: http.Server;
  private mappedNames: { [key: string]: boolean };

  constructor(log: Logger, config: HubConfig, api: API) {
    if (config && config.sentry_dsn) {
      Sentry.init({ dsn: config.sentry_dsn });
    } else if (config) {
      Sentry.captureException = () => null;
    }
    this.log = log;
    this.log.info('Initializing platform: ', config);
    this.config = config;
    // Save the API object as plugin needs to register new accessory via this object
    this.api = api;
    this.log.info(`homebridge API version: ${api.version}`);
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;
    this.PlatformAccessory = this.api.platformAccessory;
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => this.discoverDevices());
    this.api.on(APIEvent.SHUTDOWN, () => this.shutdown());
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
    this.log.info(`Found ${this.mappedAccessories.size} accessories`);
    this.log.info('Subscribed to root object');
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

  updateAccessory(id: string, data: DeviceData) {
    const comelitAccessory = this.mappedAccessories.get(id);
    if (comelitAccessory) {
      comelitAccessory.update(data);
      if (data.sub_type === OBJECT_SUBTYPE.CLIMA_THERMOSTAT_DEHUMIDIFIER) {
        this.mappedAccessories.get(`${id}#D`).update(data);
      }
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
        Sentry.captureException(e);
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
        this.mappedAccessories.set(
          id,
          new Blind(this, accessory, this.client, this.config.blind_closing_time)
        );
      }
    });
  }

  private mapThermostats(homeIndex: HomeIndex) {
    const thermostatIds = [...homeIndex.thermostatsIndex.keys()];
    this.log.info(`Found ${thermostatIds.length} thermostats`);
    thermostatIds.forEach(id => {
      const deviceData = homeIndex.thermostatsIndex.get(id);
      if (deviceData) {
        this.log.debug(`Thermostat ID: ${id}, ${deviceData.descrizione}`);
        const accessory = this.createHapAccessory(deviceData, Categories.THERMOSTAT);
        this.mappedAccessories.set(id, new Thermostat(this, accessory, this.client));
        if (
          deviceData.sub_type === OBJECT_SUBTYPE.CLIMA_THERMOSTAT_DEHUMIDIFIER &&
          this.config.hide_dehumidifiers !== true
        ) {
          const thermoAccessory = this.createHapAccessory(
            deviceData,
            Categories.AIR_DEHUMIDIFIER,
            `${deviceData.objectId}#D`
          );
          this.mappedAccessories.set(
            `${id}#D`,
            new Dehumidifier(this, thermoAccessory, this.client)
          );
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

  private createHapAccessory(deviceData: DeviceData, category: Categories, id?: string) {
    const uuid = this.api.hap.uuid.generate(id || deviceData.id);
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
    const accessory =
      existingAccessory ||
      new this.PlatformAccessory(this.getDeviceName(deviceData), uuid, category);
    accessory.context = deviceData;
    if (existingAccessory) {
      this.log.debug(`Reuse accessory from cache with uuid ${uuid} of type ${category}`);
    } else {
      this.log.debug(`Registering new accessory with uuid ${uuid} of type ${category}`);
      this.api.registerPlatformAccessories('homebridge-comelit-platform', 'Comelit', [accessory]);
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
      Sentry.captureException(e);
      return false;
    }

    try {
      await this.client.login();
      await this.client.subscribeObject(ROOT_ID);
      this.keepAlive();
      return true;
    } catch (e) {
      this.log.error('Error logging in', e);
      Sentry.captureException(e);
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
