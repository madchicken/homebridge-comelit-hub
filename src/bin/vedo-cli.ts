#!/usr/bin/env node
import yargs = require('yargs');
import chalk = require('chalk');
import {VedoClient} from "../vedo-client";

interface ClientOptions {
    host: string,
    code: string,
}

const options: ClientOptions & any = yargs.scriptName("vedo-cli")
    .option('host', {alias: 'h', type: 'string', demandOption: true})
    .option('code', {alias: 'c', type: 'string', demandOption: true})
    .command('area', 'Get info about active areas', {
        desc: {
            describe: 'Get info about areas status',
        },
        status: {
            describe: 'Get info about active areas',
        },
        active: {
            describe: 'Get active areas',
        },
        arm: {
            describe: 'Arm a specific area',
            type: 'number',
        },
        disarm: {
            describe: 'Arm a specific area',
            type: 'number',
        }
    })
    .command('zone', 'Get info about active zones', {
        desc: {
            describe: 'Get info about zones status',
        },
        status: {
            describe: 'Get info about active zones',
        },
    })
    .demandCommand()
    .help().argv;

let client: VedoClient = null;

async function run() {
    const command = options._[0];
    console.log(chalk.green(`Executing command ${command} - ${JSON.stringify(options)}`));
    try {
        switch (command) {
            case 'area':
                if (options.desc) {
                    await areaDesc(options.host, options.code);
                }
                if (options.status) {
                    await areaStatus(options.host, options.code);
                }
                if (options.active) {
                    await activeAreas(options.host, options.code);
                }
                if (options.arm !== undefined) {
                    await armArea(options.host, options.code, options.arm)
                } else if (options.disarm !== undefined) {
                    await disarmArea(options.host, options.code, options.disarm)
                }
                break;
            case 'zone':
                if (options.desc) {
                    await zoneDesc(options.host, options.code);
                }
                if (options.status) {
                    await zoneStatus(options.host, options.code);
                }
                break;
            default:
                console.error(chalk.red(`Unknown command ${command}`));
                process.exit(1);
        }

        console.log(chalk.green('Shutting down'));
        await client.shutdown();
        console.log(chalk.green(`Command ${command} executed successfully`));
    } catch (e) {
        console.error(e);
        await client.shutdown();
    }
}

async function areaDesc(address: string, code: string) {
    console.log(chalk.green(`Running area desc command for VEDO running at http://${address}`));
    client = new VedoClient(address);
    const uid = await client.loginWithRetry(code);
    const desc = await client.areaDesc(uid);
    console.log(desc);
}

async function zoneDesc(address: string, code: string) {
    console.log(chalk.green(`Running zone desc command for VEDO running at http://${address}`));
    client = new VedoClient(address);
    const uid = await client.loginWithRetry(code);
    const desc = await client.zoneDesc(uid);
    console.log(desc);
}

async function areaStatus(address: string, code: string) {
    console.log(chalk.green(`Running area status command for VEDO running at http://${address}`));
    client = new VedoClient(address);
    const uid = await client.loginWithRetry(code);
    const stats = await client.areaStatus(uid);
    console.log(stats);
}

async function zoneStatus(address: string, code: string) {
    console.log(chalk.green(`Running zone status command for VEDO running at http://${address}`));
    client = new VedoClient(address);
    const uid = await client.loginWithRetry(code);
    const stats = await client.zoneStatus(uid);
    console.log(stats);
}

async function activeAreas(address: string, code: string) {
    console.log(chalk.green(`Getting active areas for VEDO running at http://${address}`));
    client = new VedoClient(address);
    const uid = await client.loginWithRetry(code);
    const desc = await client.findActiveAreas(uid);
    console.log(desc);
}

async function armArea(address: string, code: string, num: number = 32) {
    console.log(chalk.green(`Arming area ${num} for VEDO running at http://${address}`));
    client = new VedoClient(address);
    const uid = await client.loginWithRetry(code);
    return await client.arm(uid, num);
}

async function disarmArea(address: string, code: string, num: number = 32) {
    console.log(chalk.green(`Disarming area ${num} for VEDO running at http://${address}`));
    client = new VedoClient(address);
    const uid = await client.loginWithRetry(code);
    return await client.disarm(uid, num);
}

run().then(() => {
    console.log(chalk.green('Exiting'));
    process.exit(0);
});
