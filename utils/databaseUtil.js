import dbConnection from "../database.js";

export async function executeQuery(sql, values) {
  return new Promise((resolve, reject) => {
    dbConnection.query(sql, values, (error, results) => {
      if (error) {
        console.log(error);
        reject([]);
      }
      resolve(results);
    });
  });
}

const DatabaseUtil = {
  executeQuery,
};

export default DatabaseUtil;
