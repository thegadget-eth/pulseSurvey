const { SlashCommandBuilder } = require("@discordjs/builders");
const { insertMessages } = require("../database/dbservice");
const waitForNextChannel = 1000; // wait for 1s
// const waitForNextChannel = 5000; // wait for 5s

/**
 * @dev fetch messages by filter
 * @param guild discord guild
 * @param channel current channel
 * @param type message type. can be an element of ["channels", "count", "date", "role", "all"] // "all" means fetch all messages from current channel or thread
 * @param limit limit fetching messages
 * @param since filtering param by date
 * @param roles filtering param by roles
 * @param channels filtering param by channel
 * @return messages
 */
const fetchMessages = async (
  guild,
  channel,
  type,
  { limit = 500, since = null, roles = null, channels = null } = {}
) => {
  let sum_messages = []; // for collecting messages
  let last_id;
  let remain = limit;
  if (type === "channels") {
    let promise = Promise.resolve();
    const channelList = channels == null ? null : channels.split(/[, ]+/);
    // iterate all channels
    guild.channels.cache.forEach(async (channel) => {
      const channelName = channel.name;

      promise = promise.then(async () => {
        if (
          channel.type === "GUILD_TEXT" &&
          (channels == null || channelList.includes(channelName))
        ) {
          try {
            //fetch all messages from the channel
            const messages = await fetchMessages(guild, channel, "all");
            sum_messages.push(...messages);
            const threads = channel.threads.cache;
            // iterate all threads
            let threadPromise = Promise.resolve();

            threads.forEach(async (thread) => {
              threadPromise = threadPromise.then(async () => {
                // fetch messages from thread
                const messages = await fetchMessages(guild, thread, "all");
                sum_messages.push(...messages);
              });
            });
            await threadPromise;
          } catch (e) {
          }
        }
      });
      // dealy between fetching channels
      return new Promise(function (resolve) {
        setTimeout(resolve, waitForNextChannel);
      });
    });
    await promise;
    return sum_messages;
  }

  // for specific one channel
  while (true) {
    // split for number of messages to fetch with limit
    const options = { limit: remain > 100 ? 100 : remain };
    if (last_id) {
      options.before = last_id;
    }
    let messages = [];
    try {
      const messagesMap = await channel.messages.fetch(options);
      messages = Array.from(messagesMap, ([id, value]) => ({ id, value }));
    } catch(e) {
    }
    if (messages.length === 0) return sum_messages;
    // fetch all
    if (type === "all") {
      sum_messages.push(...messages);
    }
    // export by-count
    if (type === "count") {
      sum_messages.push(...messages);
      remain -= 100;
      if (messages.length != 100 || sum_messages.length >= limit) {
        return sum_messages;
      }
    }
    // export by-date
    if (type === "date") {
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].value.createdTimestamp < since) {
          sum_messages.push(...messages.slice(0, i));
          return sum_messages;
        }
      }
      sum_messages.push(...messages);
    }
    // export by-role
    if (type === "role") {
      // parse role message and get separate roles as a list
      const roleList = extractRoles(roles);
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
            sum_messages.push(message);
          }
        }
      }
    }
    last_id = messages[messages.length - 1].id;
  }
};
/**
 * @dev parse roles string to get separate role
 * @param roles role input string
 * @exampleInput  <@1015314731352989707> @everyone<@968122690118512720>
 * @exampleOutput  ['1015314731352989707', 'everyone', '968122690118512720']
 */
const extractRoles = (roles) => {
  const roleList = roles
    .split(/<@&(\d+)>|<@(\d+)>|@([\w\d\-\. ]+)|\s/)
    .filter(Boolean);
  return roleList;
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
      await insertMessagesByCommand(interaction);
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
 * insert messages to database
 */

async function insertMessagesByCommand(interaction, channelId = null) {
  const guild = await interaction.client.guilds.cache.get(interaction.guildId);
  const channel = interaction.client.channels.cache.get(
    channelId ? channelId : interaction.channelId
  );

  if (!channel) return null;
  let messages = [];
  switch (interaction.options._subcommand) {
    case "by-count":
      const limit = interaction.options.getString("count");
      messages = await fetchMessages(guild, channel, "count", { limit });
      break;
    case "by-date":
      const since = interaction.options.getString("since");
      messages = await fetchMessages(guild, channel, "date", { since });
      break;
    case "by-role":
      const roles = interaction.options.getString("roles");
      messages = await fetchMessages(guild, channel, "role", { roles });
      break;
    case "by-channel":
      const channels = interaction.options.getString("channels");
      messages = await fetchMessages(guild, channel, "channels", { channels });
      break;

    default:
      throw "wrong command";
  }

  const guildID = interaction.guildId;
  insertMessages(guildID, messages);
  return messages;
}

const noticeToUser = (interaction) => {
  const id = interaction.user.id;
  interaction.client.users.cache.get(id).send("Successfully extracted!!!");
};
