const { SlashCommandBuilder } = require("@discordjs/builders");
const Discord = require("discord.js");
const fs = require("fs");
const archiver = require("archiver");
const path = require("path");

const moment = require('moment');
const { databaseService, heatmapService, rawInfoService, } = require('tc-dbcomm');
const database = process.env.DATABASE ?? 'mongodb+srv://root:root@cluster0.mgy22jx.mongodb.net/test';

const heatmapSample = {
  date: moment("2022-02-01 08:30:26.127Z").toDate(),
  channel: "db9",
  messages: [0, 1, 1, 1, 2, 0, 0, 1, 1, 0, 1, 0, 2, 0, 4, 3, 1, 2, 0, 1, 0, 1, 0, 2],
  interactions: [0, 1, 1, 1, 2, 0, 0, 1, 1, 0, 1, 0, 2, 0, 4, 3, 1, 2, 0, 1, 0, 1, 0, 2],
  emojis: [0, 1, 1, 1, 2, 0, 0, 1, 1, 0, 1, 0, 2, 0, 4, 3, 1, 2, 0, 1, 0, 1, 0, 2]
}


// const waitForNextChannel = 1000; // wait for 1s
const waitForNextChannel = 5000; // wait for 5s
// const waitForNextChannel = 10000 * 60; // wait for 10min

const insertToDB = async (connection, messages) => {
  // heatmapService.createHeatMap(connection1, heatmapSample);
  const promises = messages.map(async ({ id, value: m }, index) => {
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
    const reply = {replied_User: '', reference_Message: ''}
    if (m.type === "REPLY" ){
      reply.replied_User = `${m.mentions?.repliedUser?.username}#${m.mentions?.repliedUser?.discriminator}`
      reply.reference_Message = m.reference?.messageId
    }
    m.content = m.content.replace(new RegExp(',', "g"), ' ');
    const row = {
      type: m.type,
      // Created_At: timeConverter(m.createdTimestamp),
      author: `${m.author.username}#${m.author.discriminator}`,
      content: m.content,
      user_Mentions: users_mentions ? users_mentions.join(",") : users_mentions,
      roles_Mentions: roles_mentions
        ? roles_mentions.join(",")
        : roles_mentions,
      reactions: reactions.join("&"),
      ...reply
    };
    rawInfoService.createRawInfo(connection, row);
  });
  await Promise.all(promises);

  
}

/**
 * @dev fetch messages by filter
 * @param guild discord guild
 * @param channel current channel
 * @param type fetching message type. can be an element of ["channels", "count", "date", "role"]
 * @param limit limit fetching messages
 * @param since filtering param by date
 * @param roles filtering param by roles
 * @param channels filtering param by channel
 * @return message type {
 *    type: "role" | "channel"
 *    succeedChannelList: [channelName],
 *    failedChannelList: [channelName],
 *    channels: [
 *      {
 *        channelName: "",
 *        channelId: "",
 *        messages: [message],
 *        threads: [
 *           {
 *              threadName: "",
 *              threadeId: "",
 *              messages: [message]
 *           }
 *        ]
 *      }
 *
 *    ]
 * }
 */
const fetchMessages = async (
  guild,
  channel,
  connection,
  type,
  { limit = 500, since = null, roles = null, channels = null } = {}
) => {

  let sum_messages = {
    type: type,
    succeedChannelList: [],
    failedChannelList: [],
    channels: [],
  }; // for collecting messages

  if(type === "date" || type === "count") sum_messages = [];
  let last_id;
  let remain = limit;
  if (type === "channels") {
    let promise = Promise.resolve();
    const channelList = channels == null ? null : channels.split(/[, ]+/);
    // iterate all channels
    guild.channels.cache.forEach(async (channel) => {
      const channelName = channel.name;
      const channelId = channel.id;
      promise = promise.then(async () => {
        if (
          channel.type === "GUILD_TEXT" &&
          (channels == null || channelList.includes(channelName))
          ) {
          console.log({channelId, channelName});
          try {
            await fetchMessages(guild, channel, connection, "role", {roles: '@everyone'})

            const threads = channel.threads.cache;
            threads.forEach(async (thread) => {
              // fetch messages from channel
              await fetchMessages(guild, thread, connection, "role", {roles: '@everyone'})
              
            });
          } catch (e) {
            console.log(e);
          }
        }
      });
      // dealy between fetching channels
      return new Promise(function (resolve) {
        setTimeout(resolve, waitForNextChannel);
      });
    });
    await promise;
    // console.log(sum_messages)
    return sum_messages;
  }

  // for specific one channel
  while (true) {
    // split for number of messages to fetch with limit
    const options = { limit: remain > 100 ? 100 : remain };
    if (last_id) {
      options.before = last_id;
    }

    const messagesMap = await channel.messages.fetch(options);
    messages = Array.from(messagesMap, ([id, value]) => ({ id, value }));
    if (messages.length === 0) return sum_messages;
    // export by-count
    if (type === "count") {
      await insertToDB(connection, messages);
      remain -= 100;
      if (messages.length != 100 || sum_messages.length >= limit) {
        return ;
      }
    }
    // export by-date
    if (type === "date") {
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].value.createdTimestamp < since) {
          await insertToDB(connection, messages.slice(0, i))
          return ;
        }
      }
      await insertToDB(connection, messages);
    }
    // export by-role
    if (type === "role") {
      // parse role message and get separate roles as a list
      const roleList = extractRoles(roles);
      const target = [];
      for (const message of messages) {
        // get the member id of each message
        const userId = message.value.author.id;
        let member = await guild.members.cache.get(userId);
        if (member && message !== undefined) {
          const hasRole = member.roles.cache.some((r) => {
            return (
              roleList.includes("everyone") ||
              roleList.includes(r.name) ||
              roleList.includes("" + r.id)
            );
          });
          if (hasRole) {
              target.push(message);
          }
        }
      }
      await insertToDB(connection, target);
    }
    last_id = messages[messages.length - 1].id;
  }
  return sum_messages;
};

/**
 * @dev parse roles string to get separate role
 * @param roles role input string
 * @exampleInput  <@1015314731352989707> @everyone<@968122690118512720>
 * @exampleOutput  ['1015314731352989707', 'everyone', '968122690118512720']
 */
const extractRoles = (roles) => {
  const roleList = roles.split(/<@&(\d+)>|<@(\d+)>|@([\w\d\-\. ]+)|\s/).filter(Boolean);
  return roleList;
}

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("export")
    .setDescription("Get excel export")
    .setDMPermission(false)
    /**
     * export by-role <roles>
     * @dev fetch messages by roles
     * @param roles type of string and required
     */
    .addSubcommand((subcommand) =>
      subcommand
        .setName("by-role")
        .setDescription("Export data by roles")
        .addStringOption((option) =>
          option
            .setName("roles")
            .setDescription("filter for roles")
            .setRequired(true)
        )
    )
    /**
     * export by-channel <channels>
     * @dev fetch messages by channels
     * @param channels type of string and required
     *                 if not specified, fetch from all channels
     */
    .addSubcommand((subcommand) =>
      subcommand
        .setName("by-channel")
        .setDescription("Export data by channels")
        .addStringOption((option) =>
          option
            .setName("channels")
            .setDescription("filter for chaneels")
            .setRequired(false)
        )
    )
    /**
     * export by-count <count>
     * @dev fetch messages that number of messages is limited to count
     * @param count type of string and required
     */
    .addSubcommand((subcommand) =>
      subcommand
        .setName("by-count")
        .setDescription("Export latest messages based on passed count")
        .addStringOption((option) =>
          option
            .setName("count")
            .setDescription("number of messages")
            .setRequired(true)
        )
    )
    /**
     * export by-date <since>
     * @dev fetch messages that number of messages is limited to count
     * @param since type of string and required
     */
    .addSubcommand((subcommand) =>
      subcommand
        .setName("by-date")
        .setDescription("Export by date")
        .addStringOption((option) =>
          option
            .setName("since")
            .setDescription("date in timestamp (milliseconds)")
            .setRequired(true)
        )
    ),
  // execute the command
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      interaction.editReply({
        content: `Will notice you after the process.`,
        ephemeral: true,
      });
      await getMessagesByCommand(interaction);
      noticeToUser(interaction);
    } catch (e) {
      console.log("====", e);
      return interaction.editReply({
        content: `Something went wrong!`,
        ephemeral: true,
      });
    }
  },
};

/**
 * get messages by extracting type
 */

async function getMessagesByCommand(interaction, channelId = null) {
  const guild = await interaction.client.guilds.cache.get(interaction.guildId);
  const channel = interaction.client.channels.cache.get(
    channelId ? channelId : interaction.channelId
  );
  const guildID = interaction.guildId;
  const connection = databaseService.connectionFactory(guildID, database);

  if (!channel) return null;
  let messages;
  switch (interaction.options._subcommand) {
    case "by-count":
      const limit = interaction.options.getString("count");
      messages = await fetchMessages(guild, channel, connection, "count", { limit });
      break;
    case "by-date":
      const since = interaction.options.getString("since");
      messages = await fetchMessages(guild, channel, connection, "date", { since });
      break;
    case "by-role":
      const roles = interaction.options.getString("roles");
      messages = await fetchMessages(guild, channel, connection, "role", { roles });
      break;
    case "by-channel":
      const channels = interaction.options.getString("channels");
      messages = await fetchMessages(guild, channel, connection, "channels", { channels });
      break;

    default:
      throw "wrong command";
  }
  return messages;
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

// change format of date to DDMMYY
const convertDateToDDMMYY = (d) => {
  // convert 2 digit integer
  d = new Date(d);
  const pad = (s) => {
    return s < 10 ? "0" + s : s % 100;
  };
  return "" + pad(d.getDate()) + pad(d.getMonth() + 1) + pad(d.getFullYear());
};

const noticeToUser = (interaction) => {
  const id = interaction.user.id;
  interaction.client.users.cache.get(id).send("Successfully extracted!!!");
}