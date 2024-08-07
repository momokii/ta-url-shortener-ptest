import http from 'k6/http';
import { check } from 'k6';
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

export function handleSummary(data) {
    console.log('Preparing the end-of-test summary...');
    return {
        "stdout": textSummary(data, { indent: ' ', enableColors: true }),
    };
}

let SCENARIO, SCENARIO_TYPE, DB_TYPE, BASE_URL // BASE ENV DATA
let USER_TYPE, JWT, PAGE, PER_PAGE // APPENDIX ENV DATA

// base env data 
SCENARIO_TYPE = __ENV.SCENARIO
DB_TYPE = __ENV.DB_TYPE

BASE_URL = __ENV.SERVICE
if(BASE_URL === 'golang') BASE_URL = __ENV.ENDPOINT_GOLANG
else BASE_URL = __ENV.ENDPOINT_NODE

// appendix env data for this scenario
USER_TYPE = __ENV.USER_TYPE
if(USER_TYPE === 'admin') {
    if(DB_TYPE === 'mongo') JWT = __ENV.JWT_ADMIN_NOSQL
    else JWT = __ENV.JWT_ADMIN_SQL
} else {
    if(DB_TYPE === 'mongo') JWT = __ENV.JWT_USER_NOSQL
    else JWT = __ENV.JWT_USER_SQL
}

PAGE= __ENV.PAGE // page number
PER_PAGE = __ENV.PER_PAGE // data per page

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
        duration: '10s',
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
    console.log(`Start Get Self Link Testing with ${SCENARIO_TYPE} test, using service ${__ENV.SERVICE} base url ${BASE_URL} and db type ${DB_TYPE}`)   
}

export const options = SCENARIO

export default function () {
    let endpoint = BASE_URL

    endpoint = `${endpoint}/links/self?page=${PAGE}&per_page=${PER_PAGE}` 

    if(DB_TYPE === 'mongo') endpoint = endpoint + '&db=mongo'

    const options = {
        headers: {
            Authorization: `Bearer ${JWT}`
        }
    }

    const res = http.get(
        endpoint,
        options
    )
    
    check(res, {
        'is status 200': (r) => r.status == 200,
    })
}
