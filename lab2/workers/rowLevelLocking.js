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

async function rowLevelLocking() {
    const client = await pool.connect();
    try {
        for (let i = 0; i < iterations; i++) {
            const res = await client.query('SELECT counter FROM users_counter WHERE user_id = $1 FOR UPDATE', [userId]);
            const counter = res.rows[0].counter + 1;
            await client.query('UPDATE users_counter SET counter = $1 WHERE user_id = $2', [counter, userId]);
        }
    } finally {
        client.release();
    }
}

rowLevelLocking()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });