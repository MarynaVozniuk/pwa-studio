const debug = require('../../util/debug').makeFileLogger(__dirname);
const { inspect, promisify } = require('util');
const fs = require('fs');
const readFile = promisify(fs.readFile);
const path = require('path');
const dotenv = require('dotenv');
const envalid = require('envalid');
const { pick } = require('lodash');
// const hogan = require('hogan.js');

const buildpackVersion = require('../../../package.json').version;
const buildpackReleaseName = `PWA Studio Buildpack v${buildpackVersion}`;

const { sections, changes } = require('./envVarDefinitions.json');
// alphabetically by env var name
const sortedChanges = changes.slice().sort();

async function configureEnvironment(env, dir, log = console) {
    const validation = {};
    for (const section of sections) {
        for (const variable of section.variables) {
            validation[variable.name] = envalid[variable.type]({
                desc: variable.desc,
                example: variable.example,
                default: variable.default
            });
        }
    }
    await assertDevEnvFile(dir, log);

    const compatEnv = await applyBackwardsCompatChanges(env, log);

    const projectConfig = envalid.cleanEnv(compatEnv, validation);
    if (debug.enabled) {
        // Only do this prettiness if we gotta
        debug(
            'Current known env',
            '\n  ' +
                inspect(pick(projectConfig, Object.keys(validation)), {
                    colors: true,
                    compact: false
                })
                    .replace(/\s*[\{\}]\s*/gm, '')
                    .replace(/,\n\s+/gm, '\n  ') +
                '\n'
        );
    }
    return projectConfig;
}

async function assertDevEnvFile(dir, log) {
    const envPath = path.join(dir, '.env');
    try {
        const parsedEnv = dotenv.parse(await readFile(envPath));
        // don't use console.log, which writes to stdout. writing to stdout
        // interferes with webpack json output
        log.info('Using environment variables from env');
        debug('Env vars from .env:', parsedEnv);
    } catch (e) {
        if (e.code === 'ENOENT') {
            log.warn(
                `\nNo .env file in ${__dirname}\n\tYou may need to copy '.env.dist' to '.env' to begin, or create your own '.env' file manually.`
            );
        } else {
            log.warn(`\nCould not retrieve and parse ${envPath}.`, e);
        }
        throw new Error('MAKE THE INQUIRER AND TEMPLATE');
    }
}

function applyBackwardsCompatChanges(env, log) {
    const mappedLegacyValues = {};
    for (const change of sortedChanges) {
        // the env isn't using the var with changes, no need to log
        const isSet = env.hasOwnProperty(change.name);
        switch (change.type) {
            case 'defaultChanged':
                // Default change only affects you if you have NOT set this var.
                if (!isSet) {
                    log.warn(
                        `Default value for ${
                            change.name
                        } has changed in ${buildpackReleaseName}, due to ${
                            change.reason
                        }.`,
                        `Old value: ${change.original} New value: ${
                            change.update
                        }`,
                        `This project does not set a custom value for ${
                            change.name
                        }, so this WILL affect the current configuration!`
                    );
                }
                break;
            case 'removed':
                if (isSet) {
                    log.warn(
                        `Environment variable ${
                            change.name
                        } has been removed in ${buildpackReleaseName}, because ${
                            change.reason
                        }.`,
                        `Current value is ${
                            env[change.name]
                        }, but it will be ignored.`
                    );
                }
                break;
            case 'renamed':
                if (isSet) {
                    log.warn(
                        `Environment variable ${
                            change.name
                        } has been renamed in ${buildpackReleaseName}`,
                        `Its new name is ${change.update}`
                    );
                    if (change.supportLegacy) {
                        if (!env.hasOwnProperty(change.update)) {
                            log.warn(
                                'The old variable will continue to work for the next several versions, but migrate it as soon as possible.'
                            );
                            mappedLegacyValues[change.update] =
                                env[change.name];
                        }
                    } else {
                        log.warn(
                            'The old variable is longer functional. Please migrate to the new ${change.update} variable as soon as possible.'
                        );
                    }
                }
                break;
            default:
                throw new Error(
                    `Found unknown change type "${
                        change.type
                    }" while trying to notify about changed env vars.`
                );
        }
    }
    return Object.assign({}, env, mappedLegacyValues);
}

module.exports = configureEnvironment;
