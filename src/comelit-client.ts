import {AsyncMqttClient} from "async-mqtt";
import {DeferredMessage, PromiseBasedQueue} from "./promise-queue";
import {generateUUID} from "./utils";
import dgram, {RemoteInfo} from "dgram";
import MQTT from "async-mqtt";
import {AddressInfo} from "net";
import Timeout = NodeJS.Timeout;

export const ROOT_ID = 'GEN#17#13#1';

const connectAsync = MQTT.connectAsync;
const CLIENT_ID_PREFIX = 'HSrv';
const HUB_ID = '0025291701EC';
const SCAN_PORT = 24199;

export enum REQUEST_TYPE {
    STATUS = 0,
    ACTION = 1,
    SUBSCRIBE = 3,
    LOGIN = 5,
    PING = 7,
    READ_PARAMS = 8,
    GET_DATETIME = 9,
    ANNOUNCE = 13,
}

export enum REQUEST_SUB_TYPE {
    CREATE_OBJ,
    UPDATE_OBJ,
    DELETE_OBJ,
    SET_ACTION_OBJ ,
    GET_TEMPO_OBJ,
    SUBSCRIBE_RT ,
    UNSUBSCRIBE_RT,
    GET_CONF_PARAM_GROUP = 23,
    NONE = -1,
}

export enum ACTION_TYPE {
    SET,
    CLIMA_MODE,
    CLIMA_SET_POINT,
    SWITCH_CLIMA_MODE = 13,
    UMI_SETPOINT = 19,
    SWITCH_UMI_MODE = 23,
}

export interface MqttIncomingMessage {
    req_type: REQUEST_TYPE;
    seq_id: number;
    req_result: number;
    req_sub_type: number;
    agent_id?: number;
    agent_type: number;
    sessiontoken?: string;
    uid?: string;
    param_type?: number;
    obj_id?: string;
    out_data?: any[];
    params_data?: Param[];
    message?: string;
}

export enum OBJECT_TYPE {
    BLIND = 2,
    LIGHT = 3,
    THERMOSTAT = 9,
    OUTLET = 10,
    POWER_SUPPLIER = 11,
    ZONE = 1001,
}

export enum OBJECT_SUBTYPE {
    SIMPLE = 1,
    ELECTRIC_BLIND = 7,
    CONSUMPTION = 15,
    THERMOSTAT_DEHUMIDIFIER = 16,
}

export const ON = 1;
export const OFF = 0;

export interface DomoticData {
    id: string;
    type: number;
    sub_type: number;
    sched_status: string;
    sched_lock: string;
    status: string;
}

export interface DeviceData extends DomoticData {
    descrizione: string;
    placeOrder?: string;
    num_modulo: string,
    num_uscita: string,
    icon_id: string,
    isProtected: string,
    objectId: string,
    placeId: string,
    elements?: DeviceInfo[];
}

export interface DeviceInfo {
    id: string;
    data: DeviceData;
}

export interface LightDeviceData extends DeviceData {
}

export interface BlindDeviceData extends DeviceData {
    tempo_uscita: number;
}

export interface OutletDeviceData extends DeviceData {
    instant_power: string,
    out_power: number,
}

export enum ThermoSeason {
    SUMMER,
    WINTER
}

export enum ClimaMode {
    NONE,
    AUTO,
    MANUAL,
    SEMI_AUTO,
    SEMI_MAN,
    OFF_AUTO,
    OFF_MANUAL,
}

export enum ObjectStatus {
    NONE = -1,
    OFF = 0,
    ON = 1,
    IDLE= 2,
    UP= 7,
    DOWN = 8,
    OPEN = 9,
    CLOSE = 10,
    ON_COOLING = 11,
}

export interface ThermostatDeviceData extends DeviceData {
    num_ingresso: number,
    num_moduloIE: string;
    num_uscitaIE: string;
    num_moduloI: string;
    num_uscitaI: string;
    num_moduloE: string;
    num_uscitaE: string;
    num_moduloI_ana: string;
    num_uscitaI_ana: string;
    num_moduloE_ana: string;
    num_uscitaE_ana: string;
    soglia_man_inv: string;
    soglia_man_est: string;
    soglia_man_notte_inv: string;
    soglia_man_notte_est: string;
    soglia_semiauto: string;
    night_mode: string;
    soglia_auto_inv: string;
    soglia_auto_est: string;
    out_enable_inv: string;
    out_enable_est: string;
    dir_enable_inv: string;
    dir_enable_est: string;
    heatAutoFanDisable: string;
    coolAutoFanDisable: string;
    heatSwingDisable: string;
    coolSwingDisable: string;
    out_type_inv: string;
    out_type_est: string;
    temp_base_inv: string;
    temp_base_est: string;
    num_moduloUD: string;
    num_uscitaUD: string;
    num_moduloU: string;
    num_uscitaU: string;
    num_moduloD: string;
    num_uscitaD: string;
    num_moduloU_ana: string;
    num_uscitaU_ana: string;
    num_moduloD_ana: string;
    num_uscitaD_ana: string;
    out_enable_umi: string;
    out_enable_deumi: string;
    dir_enable_umi: string;
    dir_enable_deumi: string;
    humAutoFanDisable: string;
    dehumAutoFanDisable: string;
    humSwingDisable: string;
    dehumSwingDisable: string;
    out_type_umi: string;
    out_type_deumi: string;
    soglia_man_umi: string;
    soglia_man_deumi: string;
    soglia_man_notte_umi: string;
    soglia_man_notte_deumi: string;
    night_mode_umi: string;
    soglia_semiauto_umi: string;
    umi_base_umi: string;
    umi_base_deumi: string;
    coolLimitMax: string;
    coolLimitMin: string;
    heatLimitMax: string;
    heatLimitMin: string;
    viewOnly: string;
    temperatura: string;
    auto_man: ClimaMode;
    est_inv: ThermoSeason;
    soglia_attiva: string;
    out_value_inv: string;
    out_value_est: string;
    dir_out_inv: string;
    dir_out_est: string;
    semiauto_enabled: string;
    umidita: string;
    auto_man_umi: ClimaMode;
    deumi_umi: string;
    soglia_attiva_umi: string;
    semiauto_umi_enabled: string;
}

export interface SupplierDeviceData extends DeviceData {
    "label_value": string,
    "label_price": string,
    "prod": string,
    "count_div": string,
    "cost": string,
    "kCO2": string,
    "compare": string,
    "groupOrder": string,
    "instant_power": string,
}

export interface MqttMessage {
    req_type: REQUEST_TYPE;
    seq_id: number;
    req_sub_type: number;
    agent_id?: number;
    agent_type?: number;
    user_name?: string;
    password?: string;
    sessiontoken?: string;
    uid?: string;
    param_type?: number;
    obj_id?: string;
    obj_type?: number;
    detail_level?: number;
    act_params?: number[];
    act_type?: number;
}

interface ComelitProps {
    client: AsyncMqttClient;
    index: number;
    agent_id?: number;
    sessiontoken?: string;
    uid?: string;
    user_name?: string;
    password?: string;
}

interface Param {
    param_name: string;
    param_value: string;
}

function deserializeMessage(message: any): MqttIncomingMessage {
    const parsed: any = JSON.parse(message.toString());
    parsed.status = parseInt(parsed.status);
    return parsed as MqttIncomingMessage;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEFAULT_TIMEOUT = 5000;

export class ComelitClient extends PromiseBasedQueue<MqttMessage, MqttIncomingMessage> {
    private readonly props: ComelitProps;
    private homeIndex: HomeIndex;
    private username: string;
    private password: string;
    private writeTopic: string;
    private readTopic: string;
    private clientId: string;
    private readonly onUpdate: (objId: string, device: DeviceData) => void;
    private readonly log: (message?: any, ...optionalParams: any[]) => void;

    constructor(onUpdate?: (objId: string, device: DeviceData) => void, log?: (message?: any, ...optionalParams: any[]) => void) {
        super();
        this.props = {
            client: null,
            index: 1,
        };
        this.onUpdate = onUpdate;
        this.log = log || console.log;
    }

    processResponse(messages: DeferredMessage<MqttMessage, MqttIncomingMessage>[], response: MqttIncomingMessage): void {
        const deferredMqttMessage = response.seq_id ? messages.find(message => message.message.seq_id == response.seq_id && message.message.req_type == response.req_type) : null;
        if (deferredMqttMessage) {
            messages.splice(messages.indexOf(deferredMqttMessage));
            if (response.req_result === 0) {
                deferredMqttMessage.promise.resolve(response);
            } else {
                deferredMqttMessage.promise.reject(response);
            }
        } else {
            if (response.obj_id && response.out_data && response.out_data.length && this.homeIndex) {
                const datum: DeviceData = response.out_data[0];
                const value = this.homeIndex.updateObject(response.obj_id, datum);
                if (this.onUpdate && value) {
                    this.log(`Updating ${response.obj_id} with data ${JSON.stringify(datum)}`);
                    this.onUpdate(response.obj_id, value);
                }
            }
        }
    }

    isLogged(): boolean {
        return !!this.props.sessiontoken;
    }

    scan(): Promise<void> {
        return new Promise(resolve => {
            const server = dgram.createSocket('udp4');
            let timeout: Timeout;
            function sendScan() {
                const message = Buffer.alloc(12);
                message.write('SCAN');
                message.writeInt32BE(0x00000000, 4);
                message.writeInt32BE(0x00FFFFFF, 8);
                server.send(message, SCAN_PORT, '255.255.255.255');
            }

            function sendInfo(address: AddressInfo) {
                const message = Buffer.alloc(12);
                this.log(`Found HUB at ${address.address}`);
                message.write('INFO');
                server.send(message, address.port, address.address);
            }

            server.bind(() => {
                server.setBroadcast(true);
                timeout = setInterval(sendScan, 3000);
            });

            server.on('listening', () => {
                const address: AddressInfo = server.address() as AddressInfo;
                this.log(`server listening ${address.address}:${address.port}`);
            });

            server.on('error', (err) => {
                this.log(`server error:\n${err.stack}`);
                clearInterval(timeout);
                server.close();
                resolve();
            });

            server.on('message', (msg, rinfo: RemoteInfo) => {
                if(msg.toString().startsWith('here')) {
                    sendInfo(rinfo);
                } else {
                    this.log(`got: ${msg} from ${rinfo.address}`);
                }
            });
        });
    }

    async init(brokerUrl: string, username: string, password: string, hub_username?: string,
               hub_password?: string, clientId?: string): Promise<AsyncMqttClient> {
        this.username = username;
        this.password = password;
        this.clientId = clientId ? `${CLIENT_ID_PREFIX}_${clientId}` : `${CLIENT_ID_PREFIX}_${generateUUID(`${Math.random()}`).toUpperCase()}`;
        this.readTopic = `${CLIENT_ID_PREFIX}/${HUB_ID}/tx/${this.clientId}`;
        this.writeTopic = `${CLIENT_ID_PREFIX}/${HUB_ID}/rx/${this.clientId}`;
        this.log(`Connecting to Comelit HUB at ${brokerUrl} with clientID ${this.clientId}`);
        this.props.client = await connectAsync(brokerUrl, {
            username: hub_username || 'hsrv-user',
            password: hub_password || 'sf1nE9bjPc',
            clientId: clientId || CLIENT_ID_PREFIX,
            keepalive: 120,
        });
        // Register to incoming messages
        await this.subscribeTopic(this.readTopic, this.handleIncomingMessage.bind(this));
        // this.setTimeout(DEFAULT_TIMEOUT);
        this.props.agent_id = await this.retriveAgentId();
        this.log(`...done: client agent id is ${this.props.agent_id}`);
        return this.props.client;
    }

    async subscribeTopic(topic: string, handler: (topic: string, message: any) => void) {
        await this.props.client.subscribe(topic);
        this.props.client.on('message', handler);
    }

    async shutdown() {
        if (this.props.client && this.props.client.connected) {
            try {
                this.flush(true);
                this.log('Comelit client unsubscribe from read topic');
                await this.props.client.unsubscribe(this.readTopic);
                this.log('Comelit client ending session');
                await this.props.client.end(true);
            } catch (e) {
                this.log(e.message);
            }
        }
        this.props.client = null;
        this.props.index = 0;
        this.props.sessiontoken = null;
        this.props.agent_id = null;
        this.log('Comelit client disconnected');
    }

    private async retriveAgentId(): Promise<number> {
        this.log('Retrieving agent id...');
        const packet: MqttMessage = {
            req_type: REQUEST_TYPE.ANNOUNCE,
            seq_id: this.props.index++,
            req_sub_type: REQUEST_SUB_TYPE.NONE,
            agent_type: 0
        };
        const msg = await this.publish(packet);
        const agentId = msg.out_data[0].agent_id;
        const descrizione = msg.out_data[0].descrizione;
        this.log(`Logged into Comelit hub: ${descrizione}`);
        return agentId;
    }

    async login(): Promise<boolean> {
        if (!this.props.agent_id) {
            throw new Error('You must initialize the client before calling login');
        }
        const packet: MqttMessage = {
            req_type: REQUEST_TYPE.LOGIN,
            seq_id: this.props.index++,
            req_sub_type: REQUEST_SUB_TYPE.NONE,
            agent_type: 0,
            agent_id: this.props.agent_id,
            user_name: this.username,
            password: this.password,
        };
        try {
            const msg = await this.publish(packet);
            this.props.sessiontoken = msg.sessiontoken;
            return true;
        } catch (e) {
            console.error(e);
            return false
        }
    }

    async readParameters(): Promise<Param[]> {
        const packet: MqttMessage = {
            req_type: REQUEST_TYPE.READ_PARAMS,
            seq_id: this.props.index++,
            req_sub_type: REQUEST_SUB_TYPE.GET_CONF_PARAM_GROUP,
            param_type: 2,
            agent_type: 0,
            agent_id: this.props.agent_id,
            sessiontoken: this.props.sessiontoken,
        };
        const response = await this.publish(packet);
        return ComelitClient.evalResponse(response).then(() => [...response.params_data]);
    }

    async subscribeObject(id: string): Promise<boolean> {
        const packet: MqttMessage = {
            req_type: REQUEST_TYPE.SUBSCRIBE,
            seq_id: this.props.index++,
            req_sub_type: REQUEST_SUB_TYPE.SUBSCRIBE_RT,
            sessiontoken: this.props.sessiontoken,
            obj_id: id,
        };
        const response = await this.publish(packet);
        return ComelitClient.evalResponse(response).then(value => value);
    }

    async ping(): Promise<boolean> {
        const packet: MqttMessage = {
            req_type: REQUEST_TYPE.PING,
            seq_id: this.props.index++,
            req_sub_type: REQUEST_SUB_TYPE.NONE,
            sessiontoken: this.props.sessiontoken,
        };
        const response = await this.publish(packet);
        return ComelitClient.evalResponse(response).then(value => value);
    }

    async device(objId: string, detailLevel?: number): Promise<DeviceData> {
        const packet: MqttMessage = {
            req_type: REQUEST_TYPE.STATUS,
            seq_id: this.props.index++,
            req_sub_type: REQUEST_SUB_TYPE.NONE,
            sessiontoken: this.props.sessiontoken,
            obj_id: objId,
            detail_level: detailLevel || 1,
        };
        const response = await this.publish(packet);
        return ComelitClient.evalResponse(response)
            .then(() => response.out_data[0] as DeviceData);
    }

    async zones(objId: string): Promise<DeviceData> {
        const packet: MqttMessage = {
            req_type: REQUEST_TYPE.STATUS,
            seq_id: this.props.index++,
            req_sub_type: REQUEST_SUB_TYPE.NONE,
            sessiontoken: this.props.sessiontoken,
            obj_id: objId,
            obj_type: 1000,
            detail_level: 1,
        };
        const response = await this.publish(packet);
        return ComelitClient.evalResponse(response)
            .then(() => response.out_data[0] as DeviceData);
    }

    async toggleDeviceStatus(id: string, status: number): Promise<boolean> {
        return this.sendAction(id, ACTION_TYPE.SET, status);
    }

    async setTemperature(id: string, temperature: number): Promise<boolean> {
        return this.sendAction(id, ACTION_TYPE.CLIMA_SET_POINT, temperature);
    }

    async switchThermostatState(id: string, state: ClimaMode): Promise<boolean> {
        return this.sendAction(id, ACTION_TYPE.SWITCH_CLIMA_MODE, state);
    }

    async sendAction(id: string, type: ACTION_TYPE, value: any) {
        const packet: MqttMessage = {
            req_type: REQUEST_TYPE.ACTION,
            seq_id: this.props.index++,
            req_sub_type: REQUEST_SUB_TYPE.SET_ACTION_OBJ,
            act_type: type,
            sessiontoken: this.props.sessiontoken,
            obj_id: id,
            act_params: [value],
        };
        const response = await this.publish(packet);
        return ComelitClient.evalResponse(response).then(value => value);
    }

    private static evalResponse(response: MqttIncomingMessage): Promise<boolean> {
        if (response.req_result === 0) {
            return Promise.resolve(true);
        }
        return Promise.reject(new Error(response.message));
    }

    mapHome(home: DeviceData): HomeIndex {
        this.homeIndex = new HomeIndex(home);
        return this.homeIndex;
    }

    private async publish(packet: MqttMessage): Promise<MqttIncomingMessage> {
        this.log(`Sending message to HUB ${JSON.stringify(packet)}`);
        try {
            await this.props.client.publish(this.writeTopic, JSON.stringify(packet));
            return await this.enqueue(packet);
        } catch (response) {
            if (response.req_result === 1 && response.message === 'invalid token') {
                await this.login(); // relogin and override invalid token
                return this.publish(packet); // resend packet
            }
            throw response;
        }
    }

    private handleIncomingMessage(topic: string, message: any) {
        const msg: MqttIncomingMessage = deserializeMessage(message);
        // this.log(`Incoming message for topic ${topic}: ${message.toString()}`);
        if (topic === this.readTopic) {
            this.processQueue(msg);
        } else {
            console.error(`Unknown topic ${topic}, message ${msg.toString()}`);
        }
    }
}

export type DeviceIndex = Map<string, DeviceData>;

class HomeIndex {
    public readonly lightsIndex = new Map<string, LightDeviceData>();
    public readonly roomsIndex = new Map() as DeviceIndex;
    public readonly thermostatsIndex = new Map<string, ThermostatDeviceData>();
    public readonly blindsIndex = new Map<string, BlindDeviceData>();
    public readonly outletsIndex = new Map<string, OutletDeviceData>();
    public readonly supplierIndex = new Map<string, SupplierDeviceData>();

    public readonly mainIndex = new Map<string, DeviceData>();

    constructor(home: DeviceData) {
        home.elements.forEach((info: DeviceInfo) => {
            this.visitElement(info);
        });
    }

    updateObject(id: string, data: DeviceData): DeviceData {
        if (this.mainIndex.has(id)) {
            const deviceData = this.mainIndex.get(id);
            const value = {...deviceData, ...data};
            this.mainIndex.set(id, value);
            return value;
        }
        return null;
    }

    private visitElement(element: DeviceInfo) {
        switch (element.data.type) {
            case OBJECT_TYPE.LIGHT:
                this.lightsIndex.set(element.id, element.data as LightDeviceData);
                break;
            case OBJECT_TYPE.ZONE:
                this.roomsIndex.set(element.id, element.data);
                break;
            case OBJECT_TYPE.THERMOSTAT:
                this.thermostatsIndex.set(element.id, element.data as ThermostatDeviceData);
                break;
            case OBJECT_TYPE.BLIND:
                this.blindsIndex.set(element.id, element.data as BlindDeviceData);
                break;
            case OBJECT_TYPE.OUTLET:
                this.outletsIndex.set(element.id, element.data as OutletDeviceData);
                break;
            case OBJECT_TYPE.POWER_SUPPLIER:
                this.supplierIndex.set(element.id, element.data as SupplierDeviceData);
                break;
        }

        this.mainIndex.set(element.id, element.data);

        if (element.data.elements) {
            element.data.elements.forEach(value => this.visitElement(value));
        }
    }
}



