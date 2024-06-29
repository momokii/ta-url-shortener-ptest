import http from 'k6/http';
import { check } from 'k6';
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

export function handleSummary(data) {
    console.log('Preparing the end-of-test summary...');
    return {
        "stdout": textSummary(data, { indent: ' ', enableColors: true }),
    };
}

let SCENARIO, SCENARIO_TYPE, DB_TYPE, BASE_URL, SHORT_LINK

SCENARIO_TYPE = __ENV.SCENARIO || 'smoke'
DB_TYPE = __ENV.DB_TYPE || 'sql'

BASE_URL = __ENV.SERVICE
if(BASE_URL === 'golang') endpoint = __ENV.ENDPOINT_GOLANG
else BASE_URL = __ENV.ENDPOINT_NODE

SHORT_LINK = __ENV.SHORT_LINK

const SCENARIOS = {
    breakpoint: {
        executor: 'ramping-arrival-rate',
        startRate: 0,
        timeUnit: '1s',
        preAllocatedVUs: 500, // start with 100 virtual users
        maxVUs: 1000, // limit virtual users to 200
        stages: [
            { duration: '60m', target: 1000 }, // max normal load
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
    stress: {
        executor: 'constant-arrival-rate',
        rate: 1,
        timeUnit: '1s',
        preAllocatedVUs: 1000,
        maxVUs: 2000,
        duration: '10s',
    },
    smoke: {
        executor: 'constant-vus',
        vus: 1,
        duration: '3s',
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

if(SCENARIO === 'breakpoint') SCENARIO.thresholds = THRESHOLD

export function setup() {
    console.log(`Start Testing with ${SCENARIO_TYPE} test, using service ${__ENV.SERVICE} base url ${BASE_URL} and db type ${DB_TYPE}`)   
}

export const options = SCENARIO

export default function () {
    // DOING TEST HERE
    let endpoint = BASE_URL 

    if(DB_TYPE === 'mongo') endpoint = endpoint + 'db=mongo'

    // const options = {
    //     headers: ''
    // }

    const res = http.get(endpoint
        // , options
    );
    
    check(res, {
        'is status 200': (r) => r.status == 200,
    })
}
