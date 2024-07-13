import http from 'k6/http';
import { check } from 'k6';
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export function handleSummary(data) {
    console.log('Preparing the end-of-test summary...');
    return {
        "stdout": textSummary(data, { indent: ' ', enableColors: true }),
    };
}

let SCENARIO, SCENARIO_TYPE, DB_TYPE, BASE_URL // BASE ENV DATA
let JWT, USER_TYPE, LONG_LINK, CUSTOM_LINK, SERVICE // APPENDIX ENV DATA

// base env data 
SCENARIO_TYPE = __ENV.SCENARIO
DB_TYPE = __ENV.DB_TYPE

BASE_URL = __ENV.SERVICE
if(BASE_URL === 'golang') BASE_URL = __ENV.ENDPOINT_GOLANG
else BASE_URL = __ENV.ENDPOINT_NODE

SERVICE =  __ENV.SERVICE

// appendix env data for this scenario
USER_TYPE = __ENV.USER_TYPE
if(USER_TYPE === 'admin') {
    if(DB_TYPE === 'mongo') JWT = __ENV.JWT_ADMIN_NOSQL
    else JWT = __ENV.JWT_ADMIN_SQL
} else {
    if(DB_TYPE === 'mongo') JWT = __ENV.JWT_USER_NOSQL
    else JWT = __ENV.JWT_USER_SQL
}

LONG_LINK = __ENV.LONG_LINK
CUSTOM_LINK = __ENV.CUSTOM_LINK === 'true' ? true : false // if provided can use custom link, we need randomizer for custom link

const SCENARIOS = {
    breakpoint: {
        executor: 'ramping-arrival-rate',
        startRate: 0,
        timeUnit: '1s',
        preAllocatedVUs: 500, // start with 100 virtual users
        maxVUs: 2000, // limit virtual users to 200
        stages: [
            { duration: '5m', target: 100 },
            { duration: '10m', target: 500 },
            { duration: '10m', target: 1000 },
            { duration: '10m', target: 1500 }, // max normal load
        ],
    },
    load: {
        executor: 'ramping-arrival-rate',
        startRate: 0,
        timeUnit: '1s',
        preAllocatedVUs: 1000, // start with 1000 virtual users
        maxVUs: 100000, // limit virtual users to 10000
        stages: [
            { duration: '0.5m', target: 31 },
            { duration: '2m', target: 31 },
            { duration: '0.5m', target: 0 },
        ],
    },
    spike: {
        executor: 'ramping-arrival-rate',
        startRate: 0,
        timeUnit: '1s',
        preAllocatedVUs: 2000,
        maxVUs: 8000,
        stages: [
            // recomendation using 50/100/200% from breakpoint test
            { duration: '1m', target: 75 }, 
            { duration: '5m', target: 75 }, 
            { duration: '1m', target: 0 },  
        ]
    },
    smoke: {
        executor: 'constant-vus',
        vus: 5,
        duration: '5s',
    }
}


const THRESHOLD = {
    http_req_failed: [
        {
        threshold:'rate<0.01',
        abortOnFail: true,
        delayAbortEval: "10s", // evaluate the condition after 10s
    }] // should be less than 1% for breakpoint
}

SCENARIO = {
    scenarios: {
        [SCENARIO_TYPE]: SCENARIOS[SCENARIO_TYPE]
    }
}

if(SCENARIO_TYPE === 'breakpoint') SCENARIO.thresholds = THRESHOLD

export function setup() {
    console.log(`Start Create New Short Link Testing with ${SCENARIO_TYPE} test, using service: ${__ENV.SERVICE} base url: ${BASE_URL} db type: ${DB_TYPE} with type user: ${USER_TYPE}`)   
}

export const options = SCENARIO

export default function () {
    let endpoint = BASE_URL

    endpoint = `${endpoint}/links?` 

    if(DB_TYPE === 'mongo') endpoint = endpoint + 'db=mongo'

    const options = {
        headers: {
            Authorization: `Bearer ${JWT}`
        }
    }

    let short_link = __ENV.SHORT_LINK
    if(CUSTOM_LINK) short_link = randomString(5, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890')

    let body = {
        long_url: LONG_LINK,
        short_url: short_link,
        custom_link: CUSTOM_LINK
    }

    if(SERVICE === 'golang') body = JSON.stringify(body)

    const res = http.post(
        endpoint,
        body,
        options
    )
    
    check(res, {
        'is status 200': (r) => r.status == 200,
    })
}
