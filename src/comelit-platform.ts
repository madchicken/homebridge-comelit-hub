import {Homebridge} from "./types";
import {ComelitClient, DeviceData, ROOT_ID} from "comelit-client";
import {ComelitAccessory} from "./accessories/comelit";
import {Lightbulb} from "./accessories/lightbulb";
import {Thermostat} from "./accessories/thermostat";
import {Blind} from "./accessories/blind";
import {Outlet} from "./accessories/outlet";
import {PowerSupplier} from "./accessories/power-supplier";
import express, {Express} from "express";
import client, {register} from "prom-client";
import * as http from "http";
import {VedoAlarm} from "./accessories/vedo-alarm";
import Timeout = NodeJS.Timeout;

const Sentry = require('@sentry/node');

export interface HubConfig {
    username: string;
    password: string;
    hub_username: string;
    hub_password: string;
    broker_url: string;
    client_id?: string;
    export_prometheus_metrics?: boolean;
    exporter_http_port?: number;
    sentry_dsn?: string;
    blind_closing_time?: number;
    disable_alarm?: boolean;
    alarm_code?: string;
    keep_alive?: number;
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

export class ComelitPlatform {
    static KEEP_ALIVE_TIMEOUT = 120000;
    public mappedAccessories: Map<string, ComelitAccessory<DeviceData>> = new Map<string, ComelitAccessory<DeviceData>>();
    private readonly log: (message?: any, ...optionalParams: any[]) => void;
    private readonly homebridge: Homebridge;
    private client: ComelitClient;
    private readonly config: HubConfig;
    private keepAliveTimer: Timeout;
    private server: http.Server;

    constructor(log: (message?: any, ...optionalParams: any[]) => void, config: HubConfig, homebridge: Homebridge) {
        if (config && config.sentry_dsn) {
            Sentry.init({dsn: config.sentry_dsn});
        } else if (config) {
            Sentry.captureException = () => null;
        }
        this.log = (str: string) => log(`[COMELIT HUB] ${str}`);
        this.log('Initializing platform: ', config);
        this.config = config;
        // Save the API object as plugin needs to register new accessory via this object
        this.homebridge = homebridge;
        this.log("homebridge API version: " + homebridge.version);
    }

    async accessories(callback: (array: any[]) => void) {
        const login = await this.login();
        if (!login || this.client.isLogged()) {
            this.log('Not logged, returning empty accessory array');
            this.mappedAccessories = new Map<string, ComelitAccessory<DeviceData>>();
        }
        this.log('Building accessories list...');
        const rootElementInfo = await this.client.device(ROOT_ID);
        const homeIndex = this.client.mapHome(rootElementInfo);
        const lightIds = [...homeIndex.lightsIndex.keys()];
        this.log(`Found ${lightIds.length} lights`);

        lightIds.forEach(id => {
            const deviceData = homeIndex.lightsIndex.get(id);
            if (deviceData) {
                this.log(`Light ID: ${id}, ${deviceData.descrizione}`);
                this.mappedAccessories.set(id, new Lightbulb(this.log, deviceData, `Light ${deviceData.descrizione}`, this.client));
            }
        });
        const thermostatIds = [...homeIndex.thermostatsIndex.keys()];
        this.log(`Found ${thermostatIds.length} thermostats`);
        thermostatIds.forEach(id => {
            const deviceData = homeIndex.thermostatsIndex.get(id);
            if (deviceData) {
                this.log(`Thermostat ID: ${id}, ${deviceData.descrizione}`);
                this.mappedAccessories.set(id, new Thermostat(this.log, deviceData, `Thermostat ${deviceData.descrizione}`, this.client));
            }
        });
        const shadeIds = [...homeIndex.blindsIndex.keys()];
        this.log(`Found ${shadeIds.length} shades`);
        shadeIds.forEach(id => {
            const deviceData = homeIndex.blindsIndex.get(id);
            if (deviceData) {
                this.log(`Blind ID: ${id}, ${deviceData.descrizione}`);
                this.mappedAccessories.set(id, new Blind(this.log, deviceData, `Blind ${deviceData.descrizione}`, this.client, this.config.blind_closing_time));
            }
        });
        const outletIds = [...homeIndex.outletsIndex.keys()];
        this.log(`Found ${outletIds.length} outlets`);
        outletIds.forEach(id => {
            const deviceData = homeIndex.outletsIndex.get(id);
            if (deviceData) {
                this.log(`Outlet ID: ${id}, ${deviceData.descrizione}`);
                this.mappedAccessories.set(id, new Outlet(this.log, deviceData, `Outlet ${deviceData.descrizione}`, this.client));
            }
        });
        const supplierIds = [...homeIndex.supplierIndex.keys()];
        this.log(`Found ${supplierIds.length} suppliers`);
        supplierIds.forEach(id => {
            const deviceData = homeIndex.supplierIndex.get(id);
            if (deviceData) {
                this.log(`Supplier ID: ${id}, ${deviceData.descrizione}`);
                this.mappedAccessories.set(id, new PowerSupplier(this.log, deviceData, `Supplier ${deviceData.descrizione}`, this.client));
            }
        });


        this.log(`Found ${this.mappedAccessories.size} accessories`);
        this.log('Subscribed to root object');

        if (!this.config.disable_alarm) {
            const parameters = await this.client.readParameters();
            const alarmEnabled = parameters.find(p => p.param_name === 'alarmEnable').param_value === '1';
            if (alarmEnabled) {
                if (this.config.alarm_code) {
                    const alarmAddress = parameters.find(p => p.param_name === 'alarmLocalAddress').param_value;
                    const alarmPort = parameters.find(p => p.param_name === 'alarmLocalPort').param_value;
                    this.log(`Alarm is enabled, mapping it at ${alarmAddress} port ${alarmPort}`);
                    callback([...this.mappedAccessories.values(), new VedoAlarm(this.log, alarmAddress, this.config.alarm_code)]);
                    return;
                } else {
                    this.log('Alarm enabled but not properly configured: missing access code');
                }
            }
        }
        callback([...this.mappedAccessories.values()]);
    }

    updateAccessory(id: string, data: DeviceData) {
        const accessory = this.mappedAccessories.get(id);
        if (accessory) {
            accessory.update(data);
        }
    }

    async keepAlive() {
        this.keepAliveTimer = setTimeout(async () => {
            try {
                await this.client.ping();
                uptime.set(1);
                this.keepAlive();
            } catch (e) {
                this.log(e);
                Sentry.captureException(e);
                this.loginWithRetry();
            }
        }, this.config.keep_alive || ComelitPlatform.KEEP_ALIVE_TIMEOUT);
    }

    private async loginWithRetry() {
        uptime.set(0);
        let logged = await this.login();
        while(!logged) {
            setTimeout(() => this.loginWithRetry(), 5000);
        }
    }

    private async login(): Promise<boolean> {
        try {
            await this.shutdown();
            this.log('Creating client and logging in...');
            this.client = this.client || new ComelitClient(this.updateAccessory.bind(this), this.log);
            await this.client.init(
                this.config.broker_url,
                this.config.username,
                this.config.password,
                this.config.hub_username,
                this.config.hub_password,
                this.config.client_id
            );
            if (!this.server && this.config.export_prometheus_metrics) {
                this.server = expr.listen(this.config.exporter_http_port || DEFAULT_HTTP_PORT);
            }
        } catch (e) {
            this.log('Error initializing MQTT client', e);
            Sentry.captureException(e);
            return false;
        }

        try {
            await this.client.login();
            await this.client.subscribeObject(ROOT_ID);
            this.keepAlive();
            return true;
        } catch (e) {
            this.log('Error logging in', e);
            Sentry.captureException(e);
            return false;
        }
    }

    private async shutdown() {
        if (this.client) {
            this.log('Shutting down old client...');
            if (this.keepAliveTimer) {
                clearTimeout(this.keepAliveTimer);
                this.keepAliveTimer = null;
            }
            await this.client.shutdown();
        }
    }
}
