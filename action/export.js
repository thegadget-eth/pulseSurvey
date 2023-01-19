const { insertMessages } = require("../database/dbservice");
const waitForNextChannel = 1000; // wait for 1s


/**
 * @dev fetch messages by filter
 * @param guild discord guild
 * @param channel current channel
 * @param type message type. can be an element of ["channels", "date"] 
 * @param limit limit fetching messages
 * @param since filtering param by date
 * @param channels filtering param by channel
 * @return messages
 */
const fetchMessages = async (
  guild,
  channel,
  type,
  { since = null, channels = null } = {}
) => {
  let sum_messages = []; // for collecting messages
  let last_id;
  if (type === "channels") {
    let promise = Promise.resolve();
    const channelList = channels;
    // iterate all channels
    guild.channels.cache.forEach(async (channel) => {
      const channelName = channel.name;
      promise = promise.then(async () => {
        if (
          channel.type === "GUILD_TEXT" &&
          (channels == null || channelList.includes(channelName))
          ) {
          try {
            //fetch all messages from the channel
            const messages = await fetchMessages(guild, channel, "date", {since: since});
            sum_messages.push(...messages);
            const threads = channel.threads.cache;
            // iterate all threads
            let threadPromise = Promise.resolve();
            
            threads.forEach(async (thread) => {
              threadPromise = threadPromise.then(async () => {
                // fetch messages from thread
                const messages = await fetchMessages(guild, thread, "date", {since: since});
                sum_messages.push(...messages);
              });
            });
            await threadPromise;
          } catch (e) {
          }
        }
      });
      // dealy between fetching channels
      return new Promise(function (resolve) {
        setTimeout(resolve, waitForNextChannel);
      });
    });
    await promise;
    return sum_messages;
  }
  // for specific one channel
  while (true) {
    // split for number of messages to fetch with limit
    const options = { limit: 100 };
    if (last_id) {
      options.before = last_id;
    }
    let messages = [];
    try {
      const messagesMap = await channel.messages.fetch(options);
      messages = Array.from(messagesMap, ([id, value]) => ({ id, value }));
    } catch(e) {
    }
    if (messages.length === 0) return sum_messages;
    // export by-date
    
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].value.createdTimestamp < since) {
        sum_messages.push(...messages.slice(0, i));
        return sum_messages;
      }
    }
    sum_messages.push(...messages);
    last_id = messages[messages.length - 1].id;
  }
};


module.exports = {
  fetchMessages,
  noticeToUser
}
