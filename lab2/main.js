const {
    Pool
} = require('pg');
const {
    Worker
} = require('worker_threads');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'lab2',
    password: '123',
    port: 5432,
});

const USER_ID = 1;
const THREADS = 10;
const ITERATIONS = 10000;
const LOG_FILE = './logs/results.log';

if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs');
}

async function initDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
      CREATE TABLE IF NOT EXISTS users_counter (
        user_id INTEGER PRIMARY KEY,
        counter INTEGER DEFAULT 0,
        version INTEGER DEFAULT 0
      )
    `);
        await client.query(`
      INSERT INTO users_counter (user_id, counter, version) 
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO NOTHING
    `, [USER_ID, 0, 0]);
    } finally {
        client.release();
    }
}

async function resetCounter() {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE users_counter SET counter = 0, version = 0 WHERE user_id = $1`, [USER_ID]);
    } finally {
        client.release();
    }
}

async function getCounterValue() {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT counter FROM users_counter WHERE user_id = $1`, [USER_ID]);
        return res.rows[0].counter;
    } finally {
        client.release();
    }
}

async function runScenario(scenarioName, workerScript) {
    const logStream = fs.createWriteStream(LOG_FILE, {
        flags: 'a'
    });

    await resetCounter();
    logStream.write(`setted 0\nStarting: ${scenarioName}\n`);

    const startTime = Date.now();
    const workers = Array.from({
        length: THREADS
    }, () => new Worker(workerScript, {
        workerData: {
            iterations: ITERATIONS,
            userId: USER_ID
        },
    }));

    let lastLogTime = Date.now();

    const logInterval = setInterval(async () => {
        const counter = await getCounterValue();
        const now = new Date();
        const timeStamp = `${now.toLocaleTimeString()} ${now.toLocaleDateString('en-GB')}`;
        logStream.write(`${timeStamp} -- counter: ${counter}\n`);
    }, 5000);

    await Promise.all(
        workers.map(worker =>
            new Promise((resolve, reject) => {
                worker.on('error', reject);
                worker.on('exit', code => {
                    if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
                    resolve();
                });
            })
        )
    );

    clearInterval(logInterval);

    const totalTime = (Date.now() - startTime) / 1000;
    const finalCounter = await getCounterValue();

    logStream.write(`\nResult for ${scenarioName}\n`);
    logStream.write(`Counter value: ${finalCounter}\n`);
    logStream.write(`Time: ${totalTime.toFixed(2)}s\n`);
    logStream.write('————————————————————————————————————————————————\n\n');

    logStream.end();
}

(async () => {
    await initDatabase();

    await runScenario('Lost-update', './workers/lostUpdate.js');
    await runScenario('In-place update', './workers/inPlaceUpdate.js');
    await runScenario('Row-level locking', './workers/rowLevelLocking.js');
    await runScenario('Optimistic concurrency control', './workers/optimisticConcurrency.js');

    pool.end();
})();