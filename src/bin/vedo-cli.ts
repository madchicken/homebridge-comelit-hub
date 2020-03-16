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
    client = new VedoClient(options.host);
    const uid = await client.loginWithRetry(options.code);
    try {
        switch (command) {
            case 'area':
                if (options.desc) {
                    await areaDesc(uid);
                }
                if (options.status) {
                    await areaStatus(uid);
                }
                if (options.active) {
                    await activeAreas(uid);
                }
                if (options.arm !== undefined) {
                    await armArea(uid, options.arm)
                } else if (options.disarm !== undefined) {
                    await disarmArea(uid, options.disarm)
                }
                break;
            case 'zone':
                if (options.desc) {
                    await zoneDesc(uid);
                }
                if (options.status) {
                    await zoneStatus(uid);
                }
                break;
            default:
                console.error(chalk.red(`Unknown command ${command}`));
                process.exit(1);
        }

        console.log(chalk.green('Shutting down'));
        await client.shutdown(uid);
        console.log(chalk.green(`Command ${command} executed successfully`));
    } catch (e) {
        console.error(e);
        await client.shutdown(uid);
    }
}

async function areaDesc(uid: string) {
    const desc = await client.areaDesc(uid);
    console.log(desc);
}

async function zoneDesc(uid: string) {
    const desc = await client.zoneDesc(uid);
    console.log(desc);
}

async function areaStatus(uid: string) {
    const stats = await client.areaStatus(uid);
    console.log(stats);
}

async function zoneStatus(uid: string) {
    const stats = await client.zoneStatus(uid);
    console.log(stats);
}

async function activeAreas(uid: string) {
    const desc = await client.findActiveAreas(uid);
    console.log(desc);
}

async function armArea(uid: string, num: number = 32) {
    const areas = await client.findActiveAreas(uid);
    const isReady = areas.reduce((prev, area) => prev && area.ready, true);
    if (isReady) {
        return await client.arm(uid, num);
    }
    return Promise.reject(new Error('Area not ready'));
}

async function disarmArea(uid: string, num: number = 32) {
    return await client.disarm(uid, num);
}

run().then(() => {
    console.log(chalk.green('Exiting'));
    process.exit(0);
});
