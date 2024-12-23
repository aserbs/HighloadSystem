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

async function optimisticConcurrency() {
    const client = await pool.connect();
    try {
        for (let i = 0; i < iterations; i++) {
            while (true) {
                const res = await client.query('SELECT counter, version FROM users_counter WHERE user_id = $1', [userId]);
                const {
                    counter,
                    version
                } = res.rows[0];
                const newCounter = counter + 1;
                const updateRes = await client.query(
                    'UPDATE users_counter SET counter = $1, version = $2 WHERE user_id = $3 AND version = $4',
                    [newCounter, version + 1, userId, version]
                );
                if (updateRes.rowCount > 0) break; // Успешное обновление, выходим из цикла
            }
        }
    } finally {
        client.release();
    }
}

optimisticConcurrency()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });