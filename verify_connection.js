const WebSocket = require('ws');
require('dotenv').config();

const PORT = 18789;
const TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN;
const URL = `ws://localhost:${PORT}`;
const DEVICE_ID = 'a2bdcd87a8a992654f96cc41e94083e8bbbfe570cadc0e8aed3eb49c5386bf43';

console.log(`Testing Device ID connection with token: ${TOKEN ? TOKEN.substring(0, 5) + '...' : 'NONE'}`);

const configs = [
    {
        name: 'Device Role / Device ID / Device Mode',
        role: 'device',
        client: { id: DEVICE_ID, version: '1.0.0', platform: 'electron', mode: 'device' },
        scopes: ['device.read', 'device.write']
    },
    {
        name: 'Device Role / Device ID / Backend Mode',
        role: 'device',
        client: { id: DEVICE_ID, version: '1.0.0', platform: 'electron', mode: 'backend' },
        scopes: ['device.read', 'device.write']
    },
    {
        name: 'Operator Role / Device ID / Backend Mode',
        role: 'operator',
        client: { id: DEVICE_ID, version: '1.0.0', platform: 'electron', mode: 'backend' },
        scopes: ['operator.read', 'operator.write']
    }
];

async function testConfig(config) {
    return new Promise((resolve) => {
        console.log(`\n--- Testing ${config.name} ---`);
        const ws = new WebSocket(URL);
        let solved = false;

        const timeout = setTimeout(() => {
            if (!solved) { ws.terminate(); resolve(false); }
        }, 3000);

        ws.on('open', () => { });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.event === 'connect.challenge') {
                    ws.send(JSON.stringify({
                        type: 'req', id: 'test', method: 'connect',
                        params: {
                            minProtocol: 3, maxProtocol: 3,
                            client: config.client,
                            role: config.role,
                            scopes: config.scopes,
                            auth: { token: TOKEN }
                        }
                    }));
                } else if (msg.type === 'res' && msg.id === 'test') {
                    solved = true;
                    clearTimeout(timeout);
                    ws.close();
                    if (msg.ok) {
                        console.log('✅ SUCCESS!');
                        resolve(true);
                    } else {
                        console.log(`❌ Failed: ${msg.error?.message}`);
                        resolve(false);
                    }
                }
            } catch (e) { }
        });
        ws.on('error', (e) => {
            if (!solved) { solved = true; clearTimeout(timeout); console.log('❌ Error: ' + e.message); resolve(false); }
        });
    });
}

(async () => {
    for (const config of configs) {
        if (await testConfig(config)) {
            console.log(`\n✨ Works with: ${config.name}`);
            process.exit(0);
        }
    }
    console.log('\n❌ All failed.');
    process.exit(1);
})();
