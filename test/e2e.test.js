import http from 'k6/http';
import { check, group } from 'k6';
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export function handleSummary(data) {
    console.log('Preparing the end-of-test summary...');
    return {
        "stdout": textSummary(data, { indent: ' ', enableColors: true }),
    };
}

let SCENARIO, SCENARIO_TYPE, DB_TYPE, BASE_URL // BASE ENV DATA
let USER_TYPE, LONG_LINK, CUSTOM_LINK, USERNAME, PASSWORD // APPENDIX ENV DATA

// base env data 
SCENARIO_TYPE = __ENV.SCENARIO
DB_TYPE = __ENV.DB_TYPE

BASE_URL = __ENV.SERVICE
if(BASE_URL === 'golang') BASE_URL = __ENV.ENDPOINT_GOLANG
else BASE_URL = __ENV.ENDPOINT_NODE

// appendix env data for this scenario
PASSWORD = __ENV.PASSWORD
USER_TYPE = __ENV.USER_TYPE
if(USER_TYPE === 'admin') USERNAME = __ENV.USERNAME_ADMIN
else USERNAME = __ENV.USERNAME_USER

LONG_LINK = __ENV.LONG_LINK
CUSTOM_LINK = __ENV.CUSTOM_LINK === 'true' ? true : false

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

if(SCENARIO === 'breakpoint') SCENARIO.thresholds = THRESHOLD

export function setup() {
    console.log(`Start E2E Testing with ${SCENARIO_TYPE} test, using service: ${__ENV.SERVICE} base url: ${BASE_URL} db type: ${DB_TYPE} with type user: ${USER_TYPE}`)   

    // for e2e setup all endpoint using within it

    const endpoints = {
        endpoint_login: `${BASE_URL}/auth/login`,
        endpoint_get_link_self: `${BASE_URL}/links/self`,
        endpoint_links: `${BASE_URL}/links`
    };
    
    const addDBType = (url) => DB_TYPE === 'mongo' ? `${url}?db=mongo` : url
    
    const updatedEndpoints = Object.fromEntries(
        Object.entries(endpoints).map(([key, value]) => [key, addDBType(value)])
    );
    
    const { endpoint_login, endpoint_get_link_self, endpoint_links } = updatedEndpoints


    return {
        endpoint_login, 
        endpoint_get_link_self, 
        endpoint_links
    }
}

export const options = SCENARIO

export default function (data) {
    let { endpoint_login, endpoint_get_link_self, endpoint_links } = data
    let id_url_created, headers, endpoint_link_main

    const create_main_get_link = (short_link) => {
        let url = BASE_URL + '/' + short_link
        if(DB_TYPE === 'mongo') url = url + '?db=mongo'
        return url
    }

    const createHeader = (token) => {
        return {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    }

    group('1. Login', () => {
        const res = http.post(
            endpoint_login,
            {
                username: USERNAME,
                password: PASSWORD
            }
        )

        const status = check(res, {
            'is status 200': (r) => r.status == 200,
        })

        if(!status) {
            console.log('Failed to login')
            return
        } else headers = createHeader(res.json().data.access_token)
    })

    group('2. Get Links Self Data', () => {
        const res = http.get(
            endpoint_get_link_self,
            headers
        )

        const status = check(res, {
            'is status 200': (r) => r.status == 200,
        })

        if(!status) {
            console.log('Failed to get link self data')
            return
        }
    })

    group('3. Create Link', () => {
        let short_link = ''
        if(CUSTOM_LINK) short_link = randomString(5, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890')

        const res = http.post(
            endpoint_links,
            {
                long_url: LONG_LINK,
                short_url: short_link,
                custom_link: CUSTOM_LINK
            },
            headers
        )
        
        const status = check(res, {
            'is status 200': (r) => r.status == 200,
        })

        if(!status) {
            console.log('Failed to create link')
            return
        } else {
            id_url_created = res.json().data.inserted_id
            endpoint_link_main = create_main_get_link(res.json().data.short_url)
        }
    })

    group('4. Check Created Link 1', () => {
        const res = http.get(
            endpoint_link_main
        )

        const status = check(res, {
            'is status 200': (r) => r.status == 200,
        })

        if(!status) {
            console.log('Failed to Check Link 1')
            return
        }
    })

    group('5. Edit Link Data', () => {
        let short_link = ''
        if(CUSTOM_LINK) short_link = randomString(5, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890')

        const res = http.patch(
            endpoint_links,
            {
                url_id: id_url_created,
                long_url: LONG_LINK,
                short_url: short_link,
                custom_link: CUSTOM_LINK
            },
            headers
        )
        
        const status = check(res, {
            'is status 200': (r) => r.status == 200,
        })

        if(!status) {
            console.log('Failed to ')
            return
        } else endpoint_link_main = create_main_get_link(res.json().data.short_url)
    })

    group('6. Check Created Link 2', () => {
        const res = http.get(
            endpoint_link_main
        )

        const status = check(res, {
            'is status 200': (r) => r.status == 200,
        })

        if(!status) {
            console.log('Failed to Check Link 2')
            return
        }
    })

    group('7. Deleted Link', () => {
        const res = http.del(
            endpoint_links,
            {
                url_id: id_url_created,
            },
            headers
        )
        
        const status = check(res, {
            'is status 200': (r) => r.status == 200,
        })

        if(!status) {
            console.log('Failed to delete link')
            return
        }
    })
    
}
