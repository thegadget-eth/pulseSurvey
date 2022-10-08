const { SlashCommandBuilder } = require("@discordjs/builders");
const formatDistanceToNow = require("date-fns/formatDistanceToNow");
const Discord = require("discord.js");
const fs = require("fs");
const { tr, fil, fi, ro } = require("date-fns/locale");
const archiver = require("archiver");

async function fetchMessages(channel, { limit = 500, since = null } = {}) {
  const sum_messages = [];
  let last_id;
  let remain = limit;

  while (true) {
    const options = { limit: remain > 100 ? 100 : remain };
    if (last_id) {
      options.before = last_id;
    }
    
    const messagesMap = await channel.messages.fetch(options);
    messages = Array.from(messagesMap, ([id, value]) => ({ id, value }));
    if (messages.length === 0)
      return sum_messages
    if (!since) {
      sum_messages.push(...messages);
      remain -= 100;
      if (messages.length != 100 || sum_messages.length >= limit) {
        return sum_messages;
      }
    } else {
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].value.createdTimestamp < since) {
          sum_messages.push(...messages.slice(0, i));
          return sum_messages;
        }
      }
      sum_messages.push(...messages);
    }

    last_id = messages[messages.length - 1].id;
  }
}

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
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      let messages = await getMessagesByCommand(interaction);
      const promises = messages.map(async (m) => {
        let messages = await getMessagesByCommand(interaction, m.id);
        if (messages) {
          const filename = await generateExcel(messages, m.id);
          return filename;
        }
      });
      const files = await Promise.all(promises);
      files.push(await generateExcel(messages, interaction.channelId));
      const filename = await zip(files, interaction.channelId);
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
    } catch (e) {
      console.log(e);
      return interaction.editReply({
        content: `Something went wrong!`,
        ephemeral: true,
      });
    }
  },
};

async function getMessagesByCommand(interaction, channelId = null) {
  const channel = interaction.client.channels.cache.get(
    channelId ? channelId : interaction.channelId
  );
  if (!channel) return null;
  let messages = [];
  switch (interaction.options._subcommand) {
    case "by-count":
      const limit = interaction.options.getString("count");
      messages = await fetchMessages(channel, { limit });
      break;
    case "by-date":
      const since = interaction.options.getString("since");
      messages = await fetchMessages(channel, { since });
      break;
    default:
      throw "wrong command";
  }
  for(const message of messages) {
    message.value.createdTimestamp = timeConverter(message.value.createdTimestamp)
  }
  return messages;
}

const getInteractions = async (id, value) => {
  let usernames = [];
  let users = await value.users.fetch();
  users = users.forEach((user) => {
    usernames.push(`${user.username}#${user.discriminator}`);
  });
  // console.log("users", id, value);
  return [usernames.toString(), id];
};

async function generateExcel(messages, channelId, callback) {
  const data = [];
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
    if (m.type === "REPLY" ){
      reply.Replied_User = `${m.mentions?.repliedUser?.username}#${m.mentions?.repliedUser?.discriminator}`
      reply.Reference_Message = m.reference?.messageId
    }
    m.content = m.content.replace(new RegExp(',', "g"), ' ');
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
  const filename = `./${channelId}.csv`;
  csvGenerator(data, filename);
  return filename;
}

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

async function zip(files, filename) {
  return new Promise((reslove, reject) => {
    filename = `./${filename}.zip`;
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
