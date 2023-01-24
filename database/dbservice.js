const { databaseService, rawInfoService, guildService, getRangeId } = require("tc-dbcomm");

// get database address
const getDB = () => {
  const db_address = process.env.DB_ADDRESS;
  const db_user = process.env.DB_USER;
  const db_password = process.env.DB_PASSWORD;
  const database = `mongodb://${db_user}:${db_password}@${db_address}/?authMechanism=DEFAULT&tls=false`;
  return database;
}

// get users with id and value
const getInteractions = async (id, value) => {
  let usernames = [];
  let users = await value.users.fetch();
  users = users.forEach((user) => {
    usernames.push(`${user.username}#${user.discriminator}`);
  });
  return [usernames.toString(), id];
};

// convert message to rawinfo depends on schema
const messageToRawinfo = async (m) => {
    const user_regexp = new RegExp("<@(\\d+)>", "g");
    const role_regexp = new RegExp("<@&(\\d+)>", "g");
    let reactions = [];
  m.reactions.cache.forEach((value, id) => {
    reactions.push(getInteractions(id, value));
  });
  
  reactions = await Promise.all(reactions);
  
  let users_mentions = m.content.match(user_regexp);
  let roles_mentions = m.content.match(role_regexp);
  if (users_mentions)
  users_mentions = users_mentions.map((s) => {
    const id = s.replace(/[<>@]/g, "");
    const user = m.mentions.users.get(id);
    const username = `${user.username}#${user.discriminator}`;
    m.content = m.content.replace(new RegExp(s, "g"), username);
    return username;
  });
  if (roles_mentions)
  roles_mentions = roles_mentions.map((s) => {
    const id = s.replace(/[<>@&]/g, "");
    const role = m.mentions.roles.get(id);
    const roleName = role ? `@${role.name}` : `@deleted-role`;
    m.content = m.content.replace(new RegExp(s, "g"), roleName);
    return roleName;
  });
  const reply = { replied_User: "", reference_Message: "" };
  if (m.type === "REPLY") {
    reply.replied_User = `${m.mentions?.repliedUser?.username}#${m.mentions?.repliedUser?.discriminator}`;
    reply.reference_Message = m.reference?.messageId;
  }
  m.content = m.content.replace(new RegExp(",", "g"), " ");
  const data = {
    type: m.type,
    created_at: new Date(m.createdTimestamp),
    author: `${m.author.username}#${m.author.discriminator}`,
    content: m.content,
    user_Mentions: users_mentions ? users_mentions.join(",") : users_mentions,
    roles_Mentions: roles_mentions ? roles_mentions.join(",") : roles_mentions,
    reactions: reactions.join("&"),
    ...reply,
    channelId: m.channelId,
    messageId: m.id
  };
  return data;
};

// insert message data into the database
const insertMessages = async (guildID, messages) => {
  const database = getDB();
  const connection = databaseService.connectionFactory(guildID, database);
  const promises = messages.map(async ({ id, value: m }) => {
    const data = await messageToRawinfo(m);
    rawInfoService.createRawInfo(connection, data);
  });
  await Promise.all(promises);
};

// fetch different guild settings from RnDAO server
const fetchSettings = async () => {
  const guildName = "RnDAO";
  const database = getDB();
  const connection = databaseService.connectionFactory(guildName, database);
  const settings = await guildService.fetchGuild(connection);
  return settings;
}

const getRange = async (guildID) => {
  const database = getDB();
  const connection = databaseService.connectionFactory(guildID, database);
  return await rawInfoService.getRangeId(connection);
}

module.exports = {
  insertMessages,
  fetchSettings,
  getRange
};
