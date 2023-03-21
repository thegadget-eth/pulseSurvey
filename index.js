const fs = require("node:fs");
const path = require("node:path");
const {
  fetchSettings,
  updateGuild,
  getRange,
} = require("./database/dbservice.js");

const { connectDB, removeConnection } = require("./database/connection");
const { fetchMessages, updateChannelInfo } = require("./action/export.js");

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
  client.once("ready", () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    // once discord bot login then extract
    extract();
  });

  await client.login(process.env.TOKEN);
};

// get required messages from discord and insert into database
const fetchAndInsert = async (setting) => {
  const { guildId, selectedChannels, period } = setting;
  try {
    const channels = selectedChannels.map((item) => item.channelId);
    const guild = await client.guilds.fetch(guildId);
    const date = new Date(period);
    const timeStamp = date.getTime();
    const storedIdRange = await getRange(guild.id);
    const [before, after] = [
      storedIdRange[0]?.messageId,
      storedIdRange[1]?.messageId,
    ];
    const messages = await fetchMessages(guild, null, "channels", {
      channels: channels,
      since: timeStamp,
      before,
      after,
    });
    return messages;
  } catch (e) {
    console.log(e);
    return [];
  }
};

// check the bot is connected to the guilds and update status
const checkBotStatus = async (settings) => {
  const promises = settings.map(async (setting) => {
    const { guildId } = setting;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      setting.isDisconnected = true;
      await updateGuild(guildId, setting);
    }
  });
  return await Promise.all(promises);
};

// toggle bot status when extracting and after that
const toggleExtraction = async (setting, status) => {
  const { guildId } = setting;
  setting.isInProgress = status;
  await updateGuild(guildId, setting);
};

// get guildid from command
const getGuildFromCmd = () => {
  const args = process.argv.slice(2);

  const portArg = args.find((arg) => arg.startsWith("--guild="));
  const guild = portArg ? portArg.split("=")[1] : null;
  return guild;
};

// extract messages from connected servers
const extract = async () => {
  // only fetch connected guilds
  const customGuildId = getGuildFromCmd();
  const settings = await fetchSettings(customGuildId);
  await checkBotStatus(settings);
  console.log(settings.length, "connected discord servers");

  for (const setting of settings) {
    const { guildId, name } = setting;
    console.log("start extraction from ", name);

    console.log("sync channel id and channel name");
    await updateChannelInfo(client, guildId);

    console.log("make isProgress true in this server");
    await toggleExtraction(setting, true);

    // fetch missed messages from discord
    console.log("fetching messages from discord server ", name);

    await fetchAndInsert(setting);
    // insert messages to the database

    console.log("make isProgress false in this server");
    await toggleExtraction(setting, false);

    removeConnection(guildId);
  }
  process.exit(0);
};

/**
 * extract messages from guild setting
 * input: npm start -- --guild=853132782821703751       -> extract messages from only one guild(853132782821703751)
 *        npm start                                     -> extract messages from all guilds
 */
const app = async () => {
  await connectDB();
  await discordLogin();
};

app();
