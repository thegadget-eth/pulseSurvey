const { SlashCommandBuilder } = require("@discordjs/builders");
const formatDistanceToNow = require("date-fns/formatDistanceToNow");
const Discord = require("discord.js");
const fs = require("fs");
const { tr, fil, fi, ro } = require("date-fns/locale");
const archiver = require("archiver");

const waitForNextChannel = 1000; // wait for 10s
// const waitForNextChannel = 10000 * 60; // wait for 10min

/**
 * @dev fetch messages by filter
 * @param guild discord guild
 * @param channel current channel
 * @param type fetching message type. can be an element of ["channels", "count", "date", "role"] 
 * @param limit limit fetching messages
 * @param since filtering param by date
 * @param roles filtering param by roles
 * @param channels filtering param by channel
 */
async function fetchMessages(guild, channel, type, { limit = 500, since = null, roles = null, channels = null} = {}) {
  const sum_messages = []; // for collecting messages
  let last_id;
  let remain = limit;
  // console.log(channel)
  if(type === "channels") {
    // fetch messages from all channles
    if(channels === null) {
      let promise = Promise.resolve();
      // iterate all channels
      guild.channels.cache.forEach(async (channel) => {
        promise = promise.then(async () => {
          if(channel.messages) {
            const messagesMap = await channel.messages.fetch();
            messages = Array.from(messagesMap, ([id, value]) => ({ id, value }));
            sum_messages.push(...messages);
          }
          // dealy between fetching channels
          return new Promise(function (resolve) {
            setTimeout(resolve, waitForNextChannel);
          });
        });
        
      });
      await promise;
      return sum_messages;
    }
    // fetch message from specific channels
    else {
      const channelList = channels.split(",");
      let promise = Promise.resolve();
      // iterate all channles
      guild.channels.cache.forEach(async (channel) => {
        promise = promise.then(async () => {
          if(channel.messages  && channelList.includes(channel.name)) {
            const messagesMap = await channel.messages.fetch();
            messages = Array.from(messagesMap, ([id, value]) => ({ id, value }));
            sum_messages.push(...messages);
          }
          // dealy between fetching channels
          return new Promise(function (resolve) {
            setTimeout(resolve, waitForNextChannel);
          });
        });
        
      });
      await promise;
      return sum_messages;
    }
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

    if (messages.length === 0)
      return sum_messages
    // export by-count
    if (type === 'count') {
      sum_messages.push(...messages);
      remain -= 100;
      if (messages.length != 100 || sum_messages.length >= limit) {
        return sum_messages;
      }
    }
    // export by-date
    if(type === 'date') {
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].value.createdTimestamp < since) {
          sum_messages.push(...messages.slice(0, i));
          return sum_messages;
        }
      }
      sum_messages.push(...messages);
    }
    // export by-role
    if(type === 'role') {
      const role = roles.split(",")
      for(const message of messages) {
        // get the member id of each message
        const userId = message.value.author.id;
        let member = await guild.members.cache.get(userId)
        if(member && message !== undefined) {
          const hasRole = member.roles.cache.some(r => {
            return role.includes(r.name);
          })
          if(hasRole) sum_messages.push(message);
        }
     }
    }
    last_id = messages[messages.length - 1].id;
  }
  return sum_messages
}

/**
 * @dev convert timestamp to formated date
 * @param timestamp given timpstamp
 * @result_format dd month(as string) yyyy HH:MM:SS
 * @result_example 31 Oct 2022 15:15:26
 */
const timeConverter = (timestamp) => {
  var a = new Date(timestamp);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate();
  var hour = a.getHours();
  var min = a.getMinutes();
  var sec = a.getSeconds();
  var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
  return time;
}

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
      let messages = await getMessagesByCommand(interaction);
      
      if(messages.length === 0) {
        interaction
        .editReply({
          content: `No match`,
          ephemeral: true,
        })
      } else {
        // generate csv files and zip into one file
        const files = [];
        files.push(await generateExcel(messages, interaction));
        const filename = await zip(files, await getZipName(interaction));
        const excelFile = new Discord.MessageAttachment(filename, filename);
        interaction
          .editReply({
            content: `Here's your excel export`,
            ephemeral: true,
            files: [excelFile],
          })
          .then((r) => {
            fs.unlinkSync(filename);
            files.map((f) => {
              if (f) fs.unlinkSync(f);
            });
          });
      }
    } catch (e) {
      console.log(e);
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
  const guild = await interaction.client.guilds.cache.get(
    interaction.guildId
  );
  const channel = interaction.client.channels.cache.get(
    channelId ? channelId : interaction.channelId
  );
  if (!channel) return null;
  let messages = [];
  switch (interaction.options._subcommand) {
    case "by-count":
      const limit = interaction.options.getString("count");
      messages = await fetchMessages(guild, channel, 'count', { limit });
      break;
    case "by-date":
      const since = interaction.options.getString("since");
      messages = await fetchMessages(guild, channel, 'date', { since });
      break;
    case "by-role":
      const roles = interaction.options.getString("roles");
      messages = await fetchMessages(guild, channel, 'role', { roles });
      break;
    case "by-channel":
      const channels = interaction.options.getString("channels");
      messages = await fetchMessages(guild, channel, 'channels', { channels});
      break;

    default:
      throw "wrong command";
  }
  // after getting all the messages, convert time format
  for(const message of messages) {
    message.value.createdTimestamp = timeConverter(message.value.createdTimestamp)
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

const convertDateToDDMMYY = (d) =>{
  // convert 2 digit integer
  const pad = (s) => { return (s < 10) ? '0' + s : s; }
  return '' + pad(d.getDate()) + pad(d.getMonth()+1) +  pad(d.getFullYear());
}

/**
 * 
 * @param interaction discord interaction 
 * @returns name of zip file which contains extraction info
 * @format Servername_ExtractionDate
 */
const getZipName = async (interaction) => {
  const guild = await interaction.client.guilds.cache.get(
    interaction.guildId
  );
  const servername = guild.name;
  const date = convertDateToDDMMYY(new Date());
  const filename = `${servername}_${date}`;

  console.log("======================>", filename);
  return filename;
}

/**
 * 
 * @param interaction discord interaction  
 * @returns name of csv file with fetched messages from channels or thread 
 */
const getFileName = async (interaction) => {
  const channelId = interaction.channelId;
  const filename = `./${channelId}.csv`;
  return filename;
}


/**
 * @dev generate excel file from getting messages
 * @param messages fetched messages
 * @param channelId channel id from which execute fetching
 */
async function generateExcel(messages, interaction, callback) {

  const data = [];
  // generate json data from messages
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
    const reply = {Replied_User: '', Reference_Message: ''}
    // check message type whether is reply or not
    if (m.type === "REPLY" ){
      reply.Replied_User = `${m.mentions?.repliedUser?.username}#${m.mentions?.repliedUser?.discriminator}`
      reply.Reference_Message = m.reference?.messageId
    }
    m.content = m.content.replace(new RegExp(',', "g"), ' ');
    // make one row data
    const row = {
      Id: m.id,
      Type: m.type,
      Created_At: m.createdTimestamp,
      Author: `${m.author.username}#${m.author.discriminator}`,
      Content: m.content,
      User_Mentions: users_mentions ? users_mentions.join(",") : users_mentions,
      Roles_Mentions: roles_mentions
        ? roles_mentions.join(",")
        : roles_mentions,
      Reactions: reactions.join("&"),
      ...reply
    };
    data[index] = row
  });
  await Promise.all(promises)
  const filename = await getFileName(interaction);
  
  //write data in csv file
  csvGenerator(data, filename);
  return filename;
}
/**
 * @dev write json data to filename
 * @param filename cvs file name
 */
function csvGenerator(json, filename) {
  const fields = Object.keys(json[0]);
  const replacer = function (key, value) {
    return value === null ? "" : value;
  };
  let csv = json.map((row) => {
    return fields
      .map((fieldName) => {
        return JSON.stringify(row[fieldName], replacer);
      })
      .join(",");
  });
  csv.unshift(fields.join(",")); // add header column
  csv = csv.join("\n");
  fs.writeFileSync(filename, csv);
}

// zip files into one file
async function zip(files, filename) {
  console.log({filename})
  return new Promise((reslove, reject) => {
    filename = `${filename}.zip`;
    const output = fs.createWriteStream(filename);
    const archive = archiver("zip", {
      gzip: true,
      zlib: { level: 9 },
    });

    archive.on("error", function (err) {
      console.log(err);
      reject(err);
    });
    archive.on("end", function (err) {
      reslove(filename);
    });

    archive.pipe(output);
    files.map((f) => {
      if (f) archive.file(f, { name: f });
    });

    archive.finalize();
  });
}
