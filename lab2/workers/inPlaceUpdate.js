const {
    Pool
} = require('pg');
const {
    workerData
} = require('worker_threads');

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'lab2',
    password: '123',
    port: 5432,
});

const {
    iterations,
    userId
} = workerData;

async function inPlaceUpdate() {
    const client = await pool.connect();
    try {
        for (let i = 0; i < iterations; i++) {
            await client.query('UPDATE users_counter SET counter = counter + 1 WHERE user_id = $1', [userId]);
        }
    } finally {
        client.release();
    }
}

inPlaceUpdate()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });