const fs = require("node:fs");
const path = require("node:path");
const {fetchSettings, getRange, insertMessages} = require("./database/dbservice.js");
const {fetchMessages} = require("./action/export.js");

const { Client, Intents } = require("discord.js");
require("dotenv").config();
const intents = new Intents(32767);
const client = new Client({ intents });

// login to discord
const discordLogin = async () => {
  
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
  await client.login(process.env.TOKEN);
}

// get required messages from discord
const fetch = async (setting) => {
  const {guildId, selectedChannels, period} = setting;
  try {
    const channels = selectedChannels.map(item => item.channelName);
    const guild = await client.guilds.fetch(guildId);
    const storedIdRange = await getRange(guild);
    const date = new Date(period);
    const timeStamp = date.getTime();
    const messages = await fetchMessages(guild, null, "channels", {channels: channels, after: storedIdRange[1].messageId, before: storedIdRange[0].messageId, since: timeStamp});
    return messages;
  } catch(e) {
    return [];
  }
}

const app = async() => {
  // fetch all guild settings
  await discordLogin();
  const settings = await fetchSettings();
  // iterate all settings
  let promise = Promise.resolve();
  settings.forEach(async (setting) => {
    promise = promise.then(async(_) => {
      const {guildId} = setting;
      // fetch missed messages from discord
      const messages = await fetch(setting);
      console.log(messages.length)
      // insert messages to the database
      await insertMessages(guildId, messages);
    });
  });
  await promise;
}

app();