const {  rawInfoService,
  guildService,
  channelsService,
  accountService,
} = require("tc_dbcomm");
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
  const isThread =
    m.channel.type !== "GUILD_TEXT" && m.channel.type !== "GUILD_VOICE";
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

// process message (insert into database & update account info) return number of messages newly added
const processMessages = async (guildId, messages) => {
  const connection = createConnection(guildId);
  let countNewMessages = 0;
  const promises = messages.map(async ({ id, value: m }) => {
    const rawinfo = await messageToRawinfo(m);
    const response = await rawInfoService.createRawInfo(connection, rawinfo);
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

// convert discord user data to account info based on schema
const userToAccount = (member) => {
  const user = member.user;
  const guild = member.guild;
  const joinTimestamp = member.joinedTimestamp;
  const roleIds = member._roles;
  const roles = [];
  for(const roleId of roleIds) {
    const role = guild.roles.cache.find((r) => r.id === roleId);
    roles.push(role.name);
  }

  const account = {
    accountId: user.id,
    account: `${user.username}#${user.discriminator}`,
    joinDate: new Date(joinTimestamp),
    roles: roles
  };
  return account;
};

// sycn user info
const updateAccount = async (guildId, member) => {
  const account = userToAccount(member);
  if(account.accountId === null) {
    return ;
  }
  const connection = createConnection(guildId);
  const find = await accountService.fetchAccount(connection, account.accountId);
  if(find) {
    const data = await accountService.updateAccount(
      connection,
      account.accountId,
      account
    );
    return data;
  }
  const data = await accountService.createAccount(
    connection,
    account
  );
  return data;
};

const updateGuild = guildService.updateGuildByGuildId;
module.exports = {
  processMessages,
  fetchSettings,
  getRange,
  updateGuild,
  updateChannel,
  updateAccount,
};
