const { rawInfoService, guildService, channelsService } = require("tc-dbcomm");
const { createConnection } = require("./connection");
// get users with id and value
const getInteractions = async (id, value) => {
  let usernames = [];
  let users = await value.users.fetch();
  users = users.forEach((user) => {
    usernames.push(`${user.username}#${user.discriminator}`);
  });
  return [usernames.toString(), id].join(",");
};

// change format of date to YYYYMMDD
const convertDateToYYYYMMDD = (date) => {
  // convert 2 digit integer
  date = new Date(date);
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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
      const username = user
        ? `${user.username}#${user.discriminator}`
        : "Deleted-user";
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
  let reply = "";
  if (m.type === "REPLY") {
    reply = `${m.mentions?.repliedUser?.username}#${m.mentions?.repliedUser?.discriminator}`;
  }
  m.content = m.content.replace(new RegExp(",", "g"), " ");
  const isThread = m.channel.type !== "GUILD_TEXT";
  const data = {
    type: m.type,
    datetime: convertDateToYYYYMMDD(new Date(m.createdTimestamp)),
    author: `${m.author.username}#${m.author.discriminator}`,
    content: m.content,
    user_mentions: users_mentions ? users_mentions.join(",") : "",
    role_mentions: roles_mentions ? roles_mentions.join(",") : "",
    reactions: reactions,
    replied_user: reply,
    channelId: isThread ? m.channel.parentId : m.channel.id,
    messageId: m.id,
    threadId: isThread ? m.channel.id : "None",
    thread: isThread ? m.channel.name : "None",
  };
  return data;
};

// insert message data into the database and return number of messages newly added
const insertMessages = async (guildId, messages) => {
  const connection = createConnection(guildId);
  let countNewMessages = 0;
  const promises = messages.map(async ({ id, value: m }) => {
    const data = await messageToRawinfo(m);
    const response = await rawInfoService.createRawInfo(connection, data);
    if (response !== false) {
      countNewMessages++;
    }
  });
  await Promise.all(promises);
  return countNewMessages;
};

/**
 * fetch one or different guild settings from RnDAO server
 * @param guildId (Snowflake | null) if it is null, fetch all guild settings, otherwise fetch one guild setting by guildId
 * @return guild setting list
 */
const fetchSettings = async (guildId) => {
  const settings = await guildService.fetchGuild(guildId);
  return settings;
};

// get latest and oldest message in the current guild
const getRange = async (guildId) => {
  const connection = createConnection(guildId);
  const range = await rawInfoService.getRangeId(connection);
  return range;
};

// sync channle id anc channel name
const updateChannel = async (guildId, channelId, channel) => {
  const connection = createConnection(guildId);
  const data = await channelsService.updateChannel(
    connection,
    channelId,
    channel
  );
  return data;
};

const updateGuild = guildService.updateGuildByGuildId;
module.exports = {
  insertMessages,
  fetchSettings,
  getRange,
  updateGuild,
  updateChannel,
};
