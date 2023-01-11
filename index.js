const fs = require("node:fs");
const path = require("node:path");
const {fetchSettings} = require("./database/dbservice.js")
const { Client, Collection, Intents } = require("discord.js");
require("dotenv").config();

// login to discord
const discordLogin = () => {
  const intents = new Intents(32767);
  const client = new Client({ intents });
  
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
const checkAndFetch = (setting) => {

}

// fetch all guild settings
const guildSettings = async() => {
  
  const settings = await fetchSettings();
  console.log(settings);
  // settings.forEach(setting => {
  //   checkAndFetch(setting);
  // });
  // console.log(settings);
}


discordLogin();

guildSettings();