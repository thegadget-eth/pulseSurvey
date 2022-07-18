const { SlashCommandBuilder } = require("@discordjs/builders");
const formatDistanceToNow = require("date-fns/formatDistanceToNow");
const xlsx = require("json-as-xlsx");
const Discord = require("discord.js");
const fs = require("fs");
const { tr } = require("date-fns/locale");

async function fetchMessages(channel, {limit = 500, since=null}={}) {
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
    if (!since){
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
      const messages = await getMessagesByCommand(interaction)
      generateExcel(messages, interaction, () => {
        const filename = `${interaction.channelId}.xlsx`;
        const excelFile = new Discord.MessageAttachment(filename, filename);
        interaction
          .editReply({
            content: `Here's your excel export`,
            ephemeral: true,
            files: [excelFile],
          })
          .then((r) => fs.unlinkSync(filename));
      })
    } catch (e) {
      console.log(e)
      return interaction
        .editReply({
          content: `Something went wrong!`,
          ephemeral: true
        })
    }
  },
};

async function getMessagesByCommand(interaction){
  const channel = interaction.client.channels.cache.get(
    interaction.channelId
  );
  switch (interaction.options._subcommand) {
    case "by-count":
      const limit = interaction.options.getString("count");
      return await fetchMessages(channel, {limit});
    case "by-date":
      const since = interaction.options.getString("since");
      return await fetchMessages(channel, {since});
    default:
      throw 'wrong command';
  }
}

function generateExcel(messages, interaction, callback){
  const data = {
    sheet: "messages",
    columns: [
      { label: "Id", value: "Id" },
      { label: "Type", value: "Type" },
      { label: "Created_At", value: "Created_At" },
      { label: "Author", value: "Author" },
      { label: "Content", value: "Content" },
      { label: "User_Mentions", value: "User_Mentions" },
      { label: "Roles_Mentions", value: "Roles_Mentions" },
      { label: "Replied_User", value: "Replied_User" },
      { label: "Reference_Message", value: "Reference_Message" },
      { label: "Reactions", value: "Reactions" },
    ],
    content: [],
  };
  messages.map(({ id, value: m }) => {
    const user_regexp = new RegExp("<@(\\d+)>", "g");
    const role_regexp = new RegExp("<@&(\\d+)>", "g");
    const reactions =
      m.reactions.cache.size !== 0
        ? Array.from(m.reactions.cache, ([id, value]) => [
            `${value.message.author.username}#${value.message.author.discriminator}`,
            id,
          ])
        : [];
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
        const roleName = `@${role.name}`;
        m.content = m.content.replace(new RegExp(s, "g"), roleName);
        return roleName;
      });
    const row = {
      Id: m.id,
      Type: m.type,
      Created_At: m.createdTimestamp,
      Author: `${m.author.username}#${m.author.discriminator}`,
      Content: m.content,
      User_Mentions: users_mentions
        ? users_mentions.join(",")
        : users_mentions,
      Roles_Mentions: roles_mentions
        ? roles_mentions.join(",")
        : roles_mentions,
      ...(m.type === "REPLY" && {
        Replied_User: `${m.mentions.repliedUser.username}#${m.mentions.repliedUser.discriminator}`,
        Reference_Message: m.reference.messageId,
      }),
      ...(reactions.length !== 0 && {
        Reactions: reactions.join("&"),
      }),
    };
    data.content.push(row);
  });
  xlsx([data], {
    fileName: interaction.channelId,
    extraLength: 3, // A bigger number means that columns will be wider
    writeOptions: {}, // Style options from https://github.com/SheetJS/sheetjs#writing-options
  });
  callback()
}