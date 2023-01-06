const moment = require('moment');
const { databaseService, heatmapService, rawInfoService, } = require('tc-dbcomm');

const heatmapSample = {
    date: moment("2022-02-01 08:30:26.127Z").toDate(),
    channel: "db9",
    messages: [0, 1, 1, 1, 2, 0, 0, 1, 1, 0, 1, 0, 2, 0, 4, 3, 1, 2, 0, 1, 0, 1, 0, 2],
    interactions: [0, 1, 1, 1, 2, 0, 0, 1, 1, 0, 1, 0, 2, 0, 4, 3, 1, 2, 0, 1, 0, 1, 0, 2],
    emojis: [0, 1, 1, 1, 2, 0, 0, 1, 1, 0, 1, 0, 2, 0, 4, 3, 1, 2, 0, 1, 0, 1, 0, 2]
}

const rawInfoSample = {
    type: "REPLY",
    author: "Boda#2954",
    content: "Message Here",
    created_at: Date(0),
    user_Mentions: ["Beshoy#5456", "Sortoite#2577"],
    roles_Mentions: ["Surrpot"],
    reactions: ["❤️"],
    replied_User: "Sortoite#2577",
    reference_Message: 1050119122215780352,
    channelId: "12312312"
}



const connection1 = databaseService.connectionFactory('guildId#1', 'mongodb+srv://root:root@cluster0.mgy22jx.mongodb.net/test');
rawInfoService.createRawInfo(connection1, rawInfoSample);

