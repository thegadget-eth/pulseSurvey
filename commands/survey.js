const { SlashCommandBuilder } = require("@discordjs/builders");


module.exports = {
  data: new SlashCommandBuilder()
    .setName("survey")
    .setDescription("Send surveys")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("by-role")
        .setDescription("Send surveys by role")
        //For multi survey role, change into addStringOption from addRoleOption
        .addStringOption((option) =>
          option
            .setName("role")
            .setDescription("list of the role")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("message").setDescription("message").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("thread-name")
            .setDescription("Name of the thread which we tag users with closed DMs in")
        )
        .addStringOption((option) =>
          option
            .setName("thread-reason")
            .setDescription("Reason of the thread which we tag users with closed DMs in")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("by-date")
        .setDescription("Send surveys by date")
        .addStringOption((option) =>
          option.setName("message").setDescription("message").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("since")
            .setDescription("date in timestamp (milliseconds)")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("till")
            .setDescription("date in timestamp (milliseconds)")
        )
        .addStringOption((option) =>
          option
            .setName("thread-name")
            .setDescription("Name of the thread which we tag users with closed DMs in")
        )
        .addStringOption((option) =>
          option
            .setName("thread-reason")
            .setDescription("Reason of the thread which we tag users with closed DMs in")
        )
    ),


  // execute the command
  async execute(interaction) {
    const threadName = interaction.options.getString("thread-name");
    const threadReason = interaction.options.getString("thread-reason");
    const guild = await interaction.client.guilds.cache.get(
      interaction.guildId
    );
    let members = await guild.members.cache.map((member) => member);
    const message = interaction.options.getString("message").replace(/\\n|\\r\\n/g, '\n')
    if (interaction.options._subcommand === "by-role") {
      // get the role message from input
      const role = interaction.options.getString("role");
      // parse role message and get separate roles as a list
      const roleList = extractRoles(role);
      if (roleList.includes("everyone"))
        members = members.filter(({ user }) => !user.bot)
      else
        //get members who have at least one role in roleList
        members = members.filter(({ roles, user }) => (!user.bot && roles.cache.some((memberRole) => {
            return roleList.includes(memberRole.name) || roleList.includes(''+memberRole.id);
          }))
        )
        console.log(members.length)
    } 
    else {
      const since = interaction.options.getString("since");
      const till = interaction.options.getString("till");
      if (till) 
        members = members.filter(({ user, joinedTimestamp }) => (!user.bot && joinedTimestamp < till && joinedTimestamp > since))
      else 
        members = members.filter(({ user, joinedTimestamp }) => (!user.bot && joinedTimestamp > since))
    }
    //sending messages to the correct members
    processMessages(interaction, members, message, {threadName, threadReason})
    await interaction.reply({ content: "Surveys sent!", ephemeral: true });
  },
};

/**
 * @dev process messages to the members by role
 * @param members selected members by given role
 * @param message message
 * @param options options for thread includes thread name and thread reason
 */
const processMessages = async (interaction, members, message, options={}) => {
  let counter = 0;
  const closedDM = []
  if(members.length === 0) return ;
  const interval = setInterval(async () => {
    const { roles, id, user } = members[counter];
    const channel = interaction.client.channels.cache.get(interaction.channelId);
    const targetUser = await interaction.client.users.fetch(id);
    targetUser
      .send(message)
      .then(() =>
        console.log(
          `Message Sent to ${targetUser.username}#${targetUser.discriminator}`
        )
      )
      .catch((e) => {
        console.error(`Couldn't DM member ${user}`)
        closedDM.push(targetUser)
      });
    counter++;
    if (counter >= members.length) {
      clearInterval(interval);
      // start thread for members who don't accept DM
      if(closedDM.length > 0)
        tagUsers(closedDM, channel, message, options)
    }
  }, 60000);
}

/**
 * @dev create thread and send message through it
 * @param channel channel for creating thread
 * @param message message
 * @param options options for thread includes thread name and thread reason
 * @param messageSize limit message size
 */
const tagUsers = async (users, channel, message, options, messageSize=50) =>{
  //create thread
  const thread = await channel.threads.create({
    name: options.threadName ? options.threadName : `Survey thread`,
    autoArchiveDuration: 60,
    reason: options.threadReason ? options.threadReason : `Needed a separate thread for people with closed DMs`,
  });
  await thread.send(message)
  //send message through the thread
  const interval = setInterval(async () => {
    if (users.length < 1)
      return clearInterval(interval);

    const message = users.splice(0, messageSize).map(t => `<@${t.id}>`).join(' ')
    await thread.send(message)
    console.log(
      `Message Sent to ${message}`
    )
  }, 60000)

}

// check whether c is digit or not
const isDigit = (c) => {
  return c >= '0' && c <= '9';
}

/**
 * @dev parse roles string to get separate role
 * @param roles role input string
 * @exampleInput  <@1015314731352989707> @everyone<@968122690118512720>
 * @exampleOutput  ['1015314731352989707', 'everyone', '968122690118512720']
 */
const extractRoles = (roles) => {
  let ans = [];
  let i = 0;
  while(i < roles.length) {
    let newRole = "";
    if(roles[i] === '@') {
      i++;
      while(roles[i] != '@' && !(roles[i] === '<'&& roles[i+1] === '@') && i < roles.length) newRole+=roles[i], i++;
    }
    else if(i < roles.length - 1 && roles[i] === '<' && roles[i+1] === '@') {
      while(i < roles.length && !isDigit(roles[i])) i++;
      while(roles[i] != '>' && i < roles.length) newRole+=roles[i], i++;
    }
    else {
      i++;
      continue;
    }
    ans.push(newRole);
  }
  return ans;
}