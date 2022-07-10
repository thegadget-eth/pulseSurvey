const { SlashCommandBuilder } = require("@discordjs/builders");
const formatDistanceToNow = require("date-fns/formatDistanceToNow");
const xlsx = require("json-as-xlsx");
const Discord = require("discord.js");
const fs = require("fs");
const { tr } = require("date-fns/locale");

async function fetchMessages(channel, limit = 500) {
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
    sum_messages.push(...messages);
    last_id = messages[messages.length - 1].id;
    remain -= 100;

    if (messages.length != 100 || sum_messages.length >= limit) {
      break;
    }
  }

  return sum_messages;
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
    ),
  async execute(interaction) {
    const count = interaction.options.getString("count");

    const channel = interaction.client.channels.cache.get(
      interaction.channelId
    );
    // await interaction.deferReply();
    fetchMessages(channel, count)
      .then((messages) => {
        const data = {
          sheet: "messages",
          columns: [
            { label: "Created_At", value: "Created_At" },
            { label: "Author", value: "Author" },
            { label: "Content", value: "Content" },
            { label: "User_Mentions", value: "User_Mentions" },
            { label: "Roles_Mentions", value: "Roles_Mentions" },
          ],
          content: [],
        };
        messages.map(({ id, value: m }) => {
          const user_regexp = new RegExp("<@(\\d+)>", "g");
          const role_regexp = new RegExp("<@&(\\d+)>", "g");
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
            Created_At: m.createdTimestamp,
            Author: `${m.author.username}#${m.author.discriminator}`,
            Content: m.content,
            User_Mentions: users_mentions
              ? users_mentions.join(",")
              : users_mentions,
            Roles_Mentions: roles_mentions
              ? roles_mentions.join(",")
              : roles_mentions,
          };
          data.content.push(row);
        });
        xlsx([data], {
          fileName: interaction.channelId,
          extraLength: 3, // A bigger number means that columns will be wider
          writeOptions: {}, // Style options from https://github.com/SheetJS/sheetjs#writing-options
        });
        const filename = `${interaction.channelId}.xlsx`;
        const excelFile = new Discord.MessageAttachment(filename, filename);
        // interaction
        //   .editReply({
        //     content: `Here's your excel export for the last ${count} messages`,
        //     ephemeral: true,
        //     files: [excelFile],
        //   })
        //   .then((r) => fs.unlinkSync(filename));
      })
      .catch((e) => console.error(e));
  },
};
