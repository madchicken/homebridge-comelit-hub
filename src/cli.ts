#!/usr/bin/env node
import yargs = require('yargs');
import chalk = require('chalk');
import {ComelitClient} from "./comelit-client";

const options = yargs.options({
        host: {type: 'string', demandOption: true},
        username: { alias: 'u', type: 'string', demandOption: true, default: 'admin'},
        password: { alias: 'p', type: 'string', demandOption: true, default: 'admin'},
        hub_username: { alias: 'hu', type: 'string', demandOption: true, default: 'hsrv-user'},
        hub_password: { alias: 'hp', type: 'string', demandOption: true},
    })
    .command('info', 'Get info about a device', {
        id: {type: 'string', demandOption: true},
    })
    .command('params', 'Get HUB parameters', {
        token: {type: 'string', demandOption: true},
    })
    .demandCommand(1, 'You need at least one command before moving on')
    .demandOption( 'host', 'You must provide the COMELIT MQTT URL')
    .help().argv;

const client = new ComelitClient();

async function run() {
    const command = options._[0];
    console.log(chalk.green(`Executing command ${command}`));
    try {
        await client.init(options.host, options.username, options.password, options.hub_username, options.hub_password);

        switch (command) {
            case 'info':
                await info(options.id as string);
                break;
            case 'params':
                await params();
                break;
            default:
                console.error(chalk.red(`Unknown command ${command}`));
        }

        await client.shutdown();
        console.log(chalk.green(`Command ${command} executed successfully`));
    } catch (e) {
        console.error(e);
        await client.shutdown();
    }
}

async function info(id: string) {
    console.log(chalk.green(`Getting device information for ${options.id}`));
    const data = await client.device(id);
    console.log(chalk.blue(JSON.stringify(data)));
}

async function params() {
    console.log(chalk.green(`Getting parameters`));
    const data = await client.readParameters();
    console.log(chalk.blue(JSON.stringify(data)));
}

run().then(() => console.log('Exiting'));
