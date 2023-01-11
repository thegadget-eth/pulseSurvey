const fs = require("node:fs");
const path = require("node:path");
const {fetchSettings} = require("./database/dbservice.js");
const {fetchMessages} = require("./action/export.js");

const { Client, Collection, Intents } = require("discord.js");
require("dotenv").config();
const intents = new Intents(32767);
const client = new Client({ intents });

// login to discord
const discordLogin = () => {
  
  const eventsPath = path.join(__dirname, "events");
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));
  
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
  client.login(process.env.TOKEN);
}


// check missing messages and store it into the database
const checkAndFetch = async (setting) => {
  const {guildId, selectedChannels, period} = setting;
  try {
    const channels = selectedChannels.map(item => item.channelName);
    const date = new Date(period);
    const timeStamp = date.getTime();

    const guild = await client.guilds.fetch(guildId)
    const messages = await fetchMessages(guild, null, "channels", {channels: channels, since:timeStamp})
    // const missedMessages = 
  } catch(e) {}
}

// fetch all guild settings
const guildSettings = async() => {
  
  const settings = await fetchSettings();
  settings.forEach(setting => {
    checkAndFetch(setting);
  });
}


discordLogin();

guildSettings();