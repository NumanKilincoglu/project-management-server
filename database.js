// database.js file.
import mysql from 'mysql';

import dotenv from 'dotenv';
dotenv.config();

const dbConnection = mysql.createPool({
    connectionLimit: 10,
    host: process.env.CLUSTER_DB_HOST,
    user: process.env.CLUSTER_DB_USER,
    password: process.env.CLUSTER_DB_PASSWORD,
    database: process.env.CLUSTER_DB_NAME,
    port: process.env.CLUSTER_PORT,
    debug: false,
    multipleStatements: true,
    supportBigNumbers: true,
});

dbConnection.getConnection((err => {
    if (err) return console.log(err);
    console.log("MySQL Connected");
}));

export default dbConnection;