const { databaseService } = require("tc-dbcomm");
require("dotenv").config();

const db_address = process.env.DB_ADDRESS;
const db_user = process.env.DB_USER;
const db_password = process.env.DB_PASSWORD;
const database = `mongodb://${db_user}:${db_password}@${db_address}`;
const connectionMap = {};

const createConnection = (guildId) => {
  try {
    if (connectionMap[guildId]) return connectionMap[guildId];
    const connection = databaseService.connectionFactory(guildId, database);
    connectionMap[guildId] = connection;
    return connection;
  } catch (e) {
    console.log(e);
    return null;
  }
};

const removeConnection = (guildId) => {
  try {
    if (connectionMap[guildId]) {
      connectionMap[guildId].close();
      connectionMap[guildId] = null;
    }
  } catch (e) {
    console.log(e);
  }
};

module.exports = {
    createConnection,
    removeConnection
}
