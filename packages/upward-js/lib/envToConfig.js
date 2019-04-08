const camelspace = require('camelspace');
const upwardConfig = camelspace('upwardJs');
const decimalRE = /^\d*\.?\d+$/;
function castValue(value) {
    const boolStrings = {
        false: false,
        true: true
    };
    const lowered = value.toString().toLowerCase();
    if (boolStrings.hasOwnProperty(lowered)) {
        return boolStrings[lowered];
    }
    if (decimalRE.test(value)) {
        return Number(value);
    }
    return value;
}
module.exports = env => {
    const config = upwardConfig.fromEnv(env);
    for (const key in config) {
        if (config.hasOwnProperty(key)) {
            config[key] = castValue(config[key]);
        }
    }
    return config;
};
