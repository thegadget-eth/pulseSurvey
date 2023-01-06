const database =
  process.env.DATABASE ??
  "mongodb+srv://root:root@cluster0.mgy22jx.mongodb.net/test";
const { databaseService, rawInfoService } = require("tc-dbcomm");

/**
 * @dev convert timestamp to formated date
 * @param timestamp given timpstamp
 * @result_format dd month(as string) yyyy HH:MM:SS
 * @result_example 31 Oct 2022 15:15:26
 */
const timeConverter = (timestamp) => {
  var a = new Date(timestamp);
  var months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate();
  var hour = a.getHours();
  var min = a.getMinutes();
  var sec = a.getSeconds();
  var time =
    date + " " + month + " " + year + " " + hour + ":" + min + ":" + sec;
  return time;
};

// get users with id and value
const getInteractions = async (id, value) => {
    let usernames = [];
    let users = await value.users.fetch();
    users = users.forEach((user) => {
      usernames.push(`${user.username}#${user.discriminator}`);
    });
    return [usernames.toString(), id];
  };
  
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
  };
  return data;
};
const insertMessages = async (guildID, messages) => {
  const connection = databaseService.connectionFactory(guildID, database);
  const promises = messages.map(async ({ id, value: m }, index) => {
    const data = await messageToRawinfo(m);
    rawInfoService.createRawInfo(connection, data);
  });
  await Promise.all(promises);
};

module.exports = {
  insertMessages: insertMessages,
};
