const { TEXTGEN_TYPES, OPENROUTER_HEADERS } = require('./constants');
const { SECRET_KEYS, readSecret } = require('./endpoints/secrets');
const { getConfigValue } = require('./util');

/**
 * Gets the headers for the Mancer API.
 * @param {import('./users').UserDirectoryList} directories User directories
 * @returns {object} Headers for the request
 */
function getMancerHeaders(directories) {
    const apiKey = readSecret(directories, SECRET_KEYS.MANCER);

    return apiKey ? ({
        'X-API-KEY': apiKey,
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

/**
 * Gets the headers for the TogetherAI API.
 * @param {import('./users').UserDirectoryList} directories User directories
 * @returns {object} Headers for the request
 */
function getTogetherAIHeaders(directories) {
    const apiKey = readSecret(directories, SECRET_KEYS.TOGETHERAI);

    return apiKey ? ({
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

/**
 * Gets the headers for the InfermaticAI API.
 * @param {import('./users').UserDirectoryList} directories User directories
 * @returns {object} Headers for the request
 */
function getInfermaticAIHeaders(directories) {
    const apiKey = readSecret(directories, SECRET_KEYS.INFERMATICAI);

    return apiKey ? ({
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

/**
 * Gets the headers for the DreamGen API.
 * @param {import('./users').UserDirectoryList} directories User directories
 * @returns {object} Headers for the request
 */
function getDreamGenHeaders(directories) {
    const apiKey = readSecret(directories, SECRET_KEYS.DREAMGEN);

    return apiKey ? ({
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

/**
 * Gets the headers for the OpenRouter API.
 * @param {import('./users').UserDirectoryList} directories User directories
 * @returns {object} Headers for the request
 */
function getOpenRouterHeaders(directories) {
    const apiKey = readSecret(directories, SECRET_KEYS.OPENROUTER);
    const baseHeaders = { ...OPENROUTER_HEADERS };

    return apiKey ? Object.assign(baseHeaders, { 'Authorization': `Bearer ${apiKey}` }) : baseHeaders;
}

/**
 * Gets the headers for the Aphrodite API.
 * @param {import('./users').UserDirectoryList} directories User directories
 * @returns {object} Headers for the request
 */
function getAphroditeHeaders(directories) {
    const apiKey = readSecret(directories, SECRET_KEYS.APHRODITE);

    return apiKey ? ({
        'X-API-KEY': apiKey,
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

/**
 * Gets the headers for the Tabby API.
 * @param {import('./users').UserDirectoryList} directories User directories
 * @returns {object} Headers for the request
 */
function getTabbyHeaders(directories) {
    const apiKey = readSecret(directories, SECRET_KEYS.TABBY);

    return apiKey ? ({
        'x-api-key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

/**
 * Gets the headers for the LlamaCPP API.
 * @param {import('./users').UserDirectoryList} directories User directories
 * @returns {object} Headers for the request
 */
function getLlamaCppHeaders(directories) {
    const apiKey = readSecret(directories, SECRET_KEYS.LLAMACPP);

    return apiKey ? ({
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

/**
 * Gets the headers for the Ooba API.
 * @param {import('./users').UserDirectoryList} directories
 * @returns {object} Headers for the request
 */
function getOobaHeaders(directories) {
    const apiKey = readSecret(directories, SECRET_KEYS.OOBA);

    return apiKey ? ({
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

/**
 * Gets the headers for the KoboldCpp API.
 * @param {import('./users').UserDirectoryList} directories
 * @returns {object} Headers for the request
 */
function getKoboldCppHeaders(directories) {
    const apiKey = readSecret(directories, SECRET_KEYS.KOBOLDCPP);

    return apiKey ? ({
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

function getOverrideHeaders(urlHost) {
    const requestOverrides = getConfigValue('requestOverrides', []);
    const overrideHeaders = requestOverrides?.find((e) => e.hosts?.includes(urlHost))?.headers;
    if (overrideHeaders && urlHost) {
        return overrideHeaders;
    } else {
        return {};
    }
}

/**
 * Sets additional headers for the request.
 * @param {import('express').Request} request Original request body
 * @param {object} args New request arguments
 * @param {string|null} server API server for new request
 */
function setAdditionalHeaders(request, args, server) {
    const headerGetters = {
        [TEXTGEN_TYPES.MANCER]: getMancerHeaders,
        [TEXTGEN_TYPES.APHRODITE]: getAphroditeHeaders,
        [TEXTGEN_TYPES.TABBY]: getTabbyHeaders,
        [TEXTGEN_TYPES.TOGETHERAI]: getTogetherAIHeaders,
        [TEXTGEN_TYPES.OOBA]: getOobaHeaders,
        [TEXTGEN_TYPES.INFERMATICAI]: getInfermaticAIHeaders,
        [TEXTGEN_TYPES.DREAMGEN]: getDreamGenHeaders,
        [TEXTGEN_TYPES.OPENROUTER]: getOpenRouterHeaders,
        [TEXTGEN_TYPES.KOBOLDCPP]: getKoboldCppHeaders,
        [TEXTGEN_TYPES.LLAMACPP]: getLlamaCppHeaders,
    };

    const getHeaders = headerGetters[request.body.api_type];
    const headers = getHeaders ? getHeaders(request.user.directories) : {};

    if (typeof server === 'string' && server.length > 0) {
        try {
            const url = new URL(server);
            const overrideHeaders =  getOverrideHeaders(url.host);

            if (overrideHeaders && Object.keys(overrideHeaders).length > 0) {
                Object.assign(headers, overrideHeaders);
            }
        } catch {
            // Do nothing
        }
    }

    Object.assign(args.headers, headers);
}

module.exports = {
    getOverrideHeaders,
    setAdditionalHeaders,
};
