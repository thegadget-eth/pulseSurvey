const fs = require("node:fs");
const path = require("node:path");
const {fetchSettings, extractMissed, insertMessages} = require("./database/dbservice.js");
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


// get required messages from discord
const fetch = async (setting) => {
  const {guildId, selectedChannels, period} = setting;
  try {
    const channels = selectedChannels.map(item => item.channelName);
    const date = new Date(period);
    const timeStamp = date.getTime();

    const guild = await client.guilds.fetch(guildId)
    const messages = await fetchMessages(guild, null, "channels", {channels: channels, since:timeStamp});
    return messages;
  } catch(e) {
    return [];
  }
}

const app = async() => {
  // fetch all guild settings
  discordLogin();
  const settings = await fetchSettings();
  // iterate all settings
  settings.forEach(async (setting) => {
    const {guildId} = setting;
    // fetch messages from discord
    const messages = await fetch(setting);
    console.log("feched: ", messages.length);
    // extract missed messages
    const missed = await extractMissed(guildId, messages);
    console.log("extracted: ", missed.length);
    // insert messages to the database
    insertMessages(guildId, missed);
    console.log("setting");
  });
  console.log("end");
  
}



app();