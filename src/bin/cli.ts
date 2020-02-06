#!/usr/bin/env node
import yargs = require('yargs');
import chalk from 'chalk';
import {ACTION_TYPE, ComelitClient} from "../comelit-client";
const readline = require('readline');

const DEFAULT_BROKER_PASSWORD = 'sf1nE9bjPc';
const DEFAULT_BROKER_USER = 'hsrv-user';

const options = yargs.options({
        host: {type: 'string', demandOption: true},
        username: { alias: 'u', type: 'string', demandOption: true, default: 'admin'},
        password: { alias: 'p', type: 'string', demandOption: true, default: 'admin'},
        broker_username: { alias: 'bu', type: 'string', demandOption: true, default: DEFAULT_BROKER_USER},
        broker_password: { alias: 'bp', type: 'string', demandOption: true, default: DEFAULT_BROKER_PASSWORD},
        client_id: {type: 'string', default: null},
    })
    .command('info', 'Get info about a device', {
        id: {type: 'string', demandOption: true},
        detail: {type: 'number', demandOption: false, default: 1},
    })
    .command('params', 'Get HUB parameters', {
    })
    .command('action', 'Send action to device', {
        id: {type: 'string', demandOption: true},
        type: {type: 'number', demandOption: true, default: ACTION_TYPE.SET},
        value: {type: 'string', demandOption: true},
    })
    .command('zones', 'Get zones for a given top zone', {
        id: {type: 'string', demandOption: true},
    })
    .command('listen', 'Subscribe to an object and listen on the read topic (CTRL+C to exit)', {
        id: {type: 'string', demandOption: false, description: 'The ID of the object to subscribe to'},
        topic: {type: 'string', demandOption: false, description: 'The topic name to listen'},
    })
    .demandCommand(1, 'You need at least one command before moving on')
    .demandOption( 'host', 'You must provide the COMELIT MQTT URL')
    .help().argv;

const client = new ComelitClient();

async function run() {
    const command = options._[0];
    console.log(chalk.green(`Executing command ${command}`));
    try {
        await client.init(options.host, options.username, options.password, options.broker_username, options.broker_password, options.client_id);
        await client.login();

        switch (command) {
            case 'info':
                await info(options.id as string, options.detail as number);
                break;
            case 'params':
                await params();
                break;
            case 'action':
                await action(options.id as string, options.type as number, options.value);
                break;
            case 'zones':
                await zones(options.id as string);
                break;
            case 'listen':
                await listen(options.id as string, options.topic as string);
                break;
            default:
                console.error(chalk.red(`Unknown command ${command}`));
        }

        console.log(chalk.green('Shutting down'));
        await client.shutdown();
        console.log(chalk.green(`Command ${command} executed successfully`));
    } catch (e) {
        console.error(e);
        await client.shutdown();
    }
}

async function info(id: string, detailLevel: number = 1) {
    console.log(chalk.green(`Getting device information for ${options.id}`));
    const data = await client.device(id, detailLevel);
    console.log(JSON.stringify(data, null, 4));
}

async function params() {
    console.log(chalk.green(`Getting parameters`));
    const data = await client.readParameters();
    console.log(JSON.stringify(data, null, 4));
}

async function action(id: string, type: number, value: any) {
    console.log(chalk.green(`Sending action ${type} with value ${value} to ${id}`));
    const data = await client.sendAction(id, type, value);
    console.log(JSON.stringify(data, null, 4));
}

async function zones(id: string) {
    console.log(chalk.green(`Retrieving zones for object ${id}`));
    const data = await client.zones(id);
    console.log(JSON.stringify(data, null, 4));
}

async function listen(id?: string, topic?: string) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    console.log(chalk.green(`Subscribing to object ${id}`));
    if (id) {
        await client.subscribeObject(id);
    }
    if (topic) {
        await client.subscribeTopic(topic, (topic, message) => {
            console.log(chalk.blue(`Received message on topic ${topic}`));
            console.log(chalk.blue(message));
        });
    }
    console.log(chalk.green(`Listening...(press CTRL+c to interrupt)`));
    return new Promise<void>((resolve) => {
        process.stdin.on('keypress', async (str, key) => {
            if (key.ctrl && key.name === 'c') {
                resolve();
            }
        });
    });
}

run().then(() => console.log('Exiting'));
