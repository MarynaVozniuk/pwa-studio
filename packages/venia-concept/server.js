process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
}
const {
    Utilities: { addImgOptMiddleware, configureEnvironment }
} = require('@magento/pwa-buildpack');
const {
    bestPractices,
    createUpwardServer,
    envToConfig
} = require('@magento/upward-js');

async function serve() {
    const projectEnv = await configureEnvironment(process.env, __dirname);

    const config = Object.assign(
        {
            bindLocal: true,
            logUrl: true
        },
        envToConfig(projectEnv),
        {
            env: projectEnv,
            before: app => {
                addImgOptMiddleware(app, projectEnv);
                app.use(bestPractices());
            }
        }
    );

    if (projectEnv.isProduction) {
        if (projectEnv.PORT) {
            console.log(
                `NODE_ENV=production and PORT set. Binding to localhost:${
                    projectEnv.PORT
                }`
            );
            config.port = projectEnv.PORT;
        } else {
            console.log(
                `NODE_ENV=production and no PORT set. Binding to localhost with random port`
            );
            config.port = 0;
        }
        await createUpwardServer(config);
        console.log(`UPWARD Server listening in production mode.`);
        return;
    }

    if (!config.host) {
        try {
            const {
                Utilities: { configureHost }
            } = require('@magento/pwa-buildpack');
            const { hostname, ports, ssl } = await configureHost({
                interactive: false,
                subdomain: projectEnv.DEV_SERVER_CUSTOM_ORIGIN_SUBDOMAIN,
                exactDomain: projectEnv.DEV_SERVER_CUSTOM_ORIGIN_EXACT_DOMAIN,
                addUniqueHash:
                    projectEnv.DEV_SERVER_CUSTOM_ORIGIN_ADD_UNIQUE_HASH
            });
            config.host = hostname;
            config.https = ssl;
            config.port = ports.staging;
        } catch (e) {
            console.log(
                'Could not configure or access custom host. Using loopback...'
            );
        }
    }

    await createUpwardServer(config);
    if (config.logUrl) {
        console.log('\nStaging server running at the address above.\n');
    } else {
        console.log('\nUPWARD server listening in staging mode.\n');
    }
}

console.log('Launching staging server...\n');
serve();
