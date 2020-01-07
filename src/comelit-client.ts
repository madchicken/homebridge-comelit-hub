import {AsyncMqttClient} from "async-mqtt";

const MQTT = require("async-mqtt");
import {DeferredMessage, PromiseBasedQueue} from "./promise-queue";

const connectAsync = MQTT.connectAsync;
const WRITE_TOPIC = 'HSrv/0025291701EC/rx/HSrv_0025291701EC3_0592EF88-AEEE-47BD-A859-9E70017';
const READ_TOPIC = 'HSrv/0025291701EC/tx/HSrv_0025291701EC3_0592EF88-AEEE-47BD-A859-9E70017';


export enum REQUEST_TYPE {
    STRUCTURE = 0,
    ACTION = 1,
    AGENT_ID = 13,
    LOGIN = 5,
    READ_PARAMS = 8,
    SUBSCRIBE = 3,
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
    out_data?: any[];
    params_data?: Param[];
    message?: string;
}

export enum ELEMENT_TYPE {
    BLIND = 2,
    LIGHT = 3,
    THERMOSTAT = 9,
    POWER_CHECK = 11,
    ROOM = 1001,
}

export enum ELEMENT_SUBTYPE {
    SIMPLE = 1,
    ELECTRIC_BLIND = 7,
    POWER = 15,
    THERMOSTAT = 17,
}

export const ON = 1;
export const OFF = 0;

export interface DeviceData {
    id: string;
    type: number;
    sub_type: number;
    descrizione: string;
    sched_status: string;
    sched_lock: string;
    status: string
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

export interface LightDeviceData extends DeviceData {}

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
    auto_man: string;
    est_inv: string;
    soglia_attiva: string;
    out_value_inv: string;
    out_value_est: string;
    dir_out_inv: string;
    dir_out_est: string;
    semiauto_enabled: string;
    umidita: string;
    auto_man_umi: string;
    deumi_umi: string;
    soglia_attiva_umi: string;
    semiauto_umi_enabled: string;
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

class MqttQueue extends PromiseBasedQueue<MqttMessage, MqttIncomingMessage> {
    processResponse(messages: DeferredMessage<MqttMessage, MqttIncomingMessage>[], response: MqttIncomingMessage): void {
        const deferredMqttMessage = messages.find(message => message.message.seq_id == response.seq_id);
        if (deferredMqttMessage) {
            if (response.req_result === 0) {
                deferredMqttMessage.promise.resolve(response);
            } else {
                deferredMqttMessage.promise.reject(response);
            }
        } else {
            console.error(`Received message for missing request: ${JSON.stringify(response)}`);
        }
    }
}

export class ComelitClient {
    private readonly props: ComelitProps;
    private readonly queue: PromiseBasedQueue<MqttMessage, MqttIncomingMessage>;
    private homeIndex: HomeIndex;
    private readonly username: string;
    private readonly password: string;

    constructor(username: string, password: string) {
        this.props = {
            client: null,
            index: 0,
        };
        this.queue = new MqttQueue();
        this.username = username;
        this.password = password;
    }

    isLogged(): boolean {
        return !!this.props.sessiontoken;
    }

    async initClient(brokerUrl: string, hub_username: string, hub_password: string): Promise<AsyncMqttClient> {
        this.props.client = await connectAsync(brokerUrl, {
            username: hub_username,
            password: hub_password,
            clientId: 'HomeKit',
            keepalive: 120,
        });
        // Register to incoming messages
        console.log('Initializing comelit client...');
        await this.props.client.subscribe(READ_TOPIC);
        await this.props.client.subscribe(WRITE_TOPIC);
        this.props.client.on('message', this.handleIncomingMessage.bind(this));
        this.props.agent_id = await this.retriveAgentId();
        console.log(`...done: client agent id is ${this.props.agent_id}`);
        return this.props.client;
    }

    private async retriveAgentId(): Promise<number> {
        console.log('Retrieving agent id...');
        const packet: MqttMessage = {
            req_type: REQUEST_TYPE.AGENT_ID,
            seq_id: this.props.index++,
            req_sub_type: -1,
            agent_type: 0
        };
        const msg = await this.publish(packet);
        const agentId = msg.out_data[0].agent_id;
        const descrizione = msg.out_data[0].descrizione;
        console.log(`Logged into Comelit hub: ${descrizione}`);
        return agentId;
    }

    async login(): Promise<boolean> {
        if (!this.props.agent_id) {
            throw new Error('You must initialize the client before calling login');
        }
        const packet: MqttMessage = {
            req_type: REQUEST_TYPE.LOGIN,
            seq_id: this.props.index++,
            req_sub_type: -1,
            agent_type: 0,
            agent_id: this.props.agent_id,
            user_name: this.username,
            password: this.password,
        };
        try {
            const msg = await this.publish(packet);
            this.props.sessiontoken = msg.sessiontoken;
            return true;
        } catch(e) {
            console.error(e);
            return false
        }
    }

    async readParameters(): Promise<Param[]> {
        const packet: MqttMessage = {
            req_type: REQUEST_TYPE.READ_PARAMS,
            seq_id: this.props.index++,
            req_sub_type: 23,
            param_type: 2,
            agent_type: 0,
            agent_id: this.props.agent_id,
            sessiontoken: this.props.sessiontoken,
        };
        const msg = await this.publish(packet);
        return [...msg.params_data];
    }

    private async subscribeObject(id: string): Promise<boolean> {
        const packet: MqttMessage = {
            req_type: REQUEST_TYPE.SUBSCRIBE,
            seq_id: this.props.index++,
            req_sub_type: 5,
            sessiontoken: this.props.sessiontoken,
            obj_id: id,
        };
        const msg = await this.publish(packet);
        return msg.req_result === 0;
    }

    async device(objId: string): Promise<DeviceData> {
        const packet: MqttMessage = {
            req_type: REQUEST_TYPE.STRUCTURE,
            seq_id: this.props.index++,
            req_sub_type: -1,
            sessiontoken: this.props.sessiontoken,
            obj_id: objId,
            detail_level: 1,
        };
        const msg = await this.publish(packet);
        return msg.out_data[0] as DeviceData;
    }

    async rooms(objId: string): Promise<DeviceData> {
        const packet: MqttMessage = {
            req_type: REQUEST_TYPE.STRUCTURE,
            seq_id: this.props.index++,
            req_sub_type: -1,
            sessiontoken: this.props.sessiontoken,
            obj_id: objId,
            obj_type: 1000,
            detail_level: 1,
        };
        const msg = await this.publish(packet);
        return msg.out_data[0] as DeviceData;
    }

    async toggleLight(id: string, status: number): Promise<boolean> {
        const packet: MqttMessage = {
            req_type: REQUEST_TYPE.ACTION,
            seq_id: this.props.index++,
            req_sub_type: 3,
            act_type: 0,
            sessiontoken: this.props.sessiontoken,
            obj_id: id,
            act_params: [status],
        };
        const response = await this.publish(packet);
        return response.req_result === 0;
    }

    mapHome(home: DeviceData): HomeIndex {
        this.homeIndex = new HomeIndex(home);
        return this.homeIndex;
    }

    private async publish(packet: MqttMessage): Promise<MqttIncomingMessage> {
        console.log('Sending message to HUB ', packet);
        await this.props.client.publish(WRITE_TOPIC, JSON.stringify(packet));
        try {
            return await this.queue.enqueue(packet);
        } catch(response) {
            if (response.req_result === 1 && response.message === 'invalid token') {
                await this.login(); // relogin and override invalid token
                return this.publish(packet); // resend packet
            }
        }
    }

    private handleIncomingMessage(topic: string, message: any) {
        const msg: MqttIncomingMessage = JSON.parse(message.toString());
        switch (topic) {
            case READ_TOPIC:
                console.log(`Incoming message`, message.toString());
                this.queue.processQueue(msg);
                break;
            case WRITE_TOPIC:
                console.log(`Outgoing message`, message.toString());
                break;
            default:
                console.error(`Unknown topic ${topic}`);
        }
    }
}

export type DeviceIndex = Map<string, DeviceData>;

class HomeIndex {
    public readonly lightsIndex = new Map<string, LightDeviceData>();
    public readonly roomsIndex = new Map() as DeviceIndex;
    public readonly thermostatsIndex = new Map<string, ThermostatDeviceData>();
    public readonly blindsIndex = new Map() as DeviceIndex;

    constructor(home: DeviceData) {
        home.elements.forEach((info: DeviceInfo) => {
            this.visitElement(info);
        });
    }

    isRoom(objId: string): boolean {
        return this.roomsIndex.has(objId);
    }

    isLight(objId: string): boolean {
        return this.lightsIndex.has(objId);
    }

    private visitElement(element: DeviceInfo) {
        if (element.data.type === ELEMENT_TYPE.LIGHT) {
            this.lightsIndex.set(element.id, element.data as LightDeviceData);
        }
        if (element.data.type === ELEMENT_TYPE.ROOM) {
            this.roomsIndex.set(element.id, element.data);
        }
        if (element.data.type === ELEMENT_TYPE.THERMOSTAT) {
            this.thermostatsIndex.set(element.id, element.data as ThermostatDeviceData);
        }
        if (element.data.type === ELEMENT_TYPE.BLIND) {
            this.blindsIndex.set(element.id, element.data);
        }
        if(element.data.elements) {
            element.data.elements.forEach(value => this.visitElement(value));
        }
    }
}



