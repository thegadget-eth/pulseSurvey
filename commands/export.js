const { SlashCommandBuilder } = require("@discordjs/builders");
const formatDistanceToNow = require("date-fns/formatDistanceToNow");
const xlsx = require("json-as-xlsx")
const Discord = require('discord.js');
const fs = require('fs');
const { tr } = require("date-fns/locale");

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
          option.setName("count").setDescription("number of messages").setRequired(true)
        )
    ),
  async execute(interaction) {
    
    const count = interaction.options.getString("count");

    const channel = interaction.client.channels.cache.get(interaction.channelId);
    await interaction.deferReply();
    channel.messages.fetch({ limit: count }).then(messages => {
      const data = {
        sheet: "messages",
        columns: [{label: "Author", value: "Author"}, {label: "Content", value: "Content"}, {label: "Mentions", value: "Mentions"}],
        content: []
      }
      messages.map(m => {
        const regexp = new RegExp('<@(\\d+)>', 'g')
        let mentions = m.content.match(regexp)
        if(mentions)
          mentions = mentions.map(s => {
            const id = s.replace(/[<>@]/g, '')
            const user = m.mentions.users.get(id)
            const username = `${user.username}#${user.discriminator}`
            m.content = m.content.replace(new RegExp(s, 'g'), username)
            return username
          })
        const row = {
          "Author": `${m.author.username}#${m.author.discriminator}`,
          "Content": m.content,
          "Mentions": mentions ? mentions.join(',') : mentions
        }
        data.content.push(row)
      })

      xlsx([data], {
        fileName: interaction.channelId, 
        extraLength: 3, // A bigger number means that columns will be wider
        writeOptions: {}, // Style options from https://github.com/SheetJS/sheetjs#writing-options
      })
      const filename = `${interaction.channelId}.xlsx`
      const excelFile = new Discord.MessageAttachment(filename, filename);
      interaction.editReply({ content: `Here's your excel export for the last ${count} messages`, ephemeral: true, files: [excelFile] })
        .then(r => fs.unlinkSync(filename))
    })
    
  },
};
