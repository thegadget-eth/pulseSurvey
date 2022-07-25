const { SlashCommandBuilder } = require("@discordjs/builders");
var formatDistanceToNow = require("date-fns/formatDistanceToNow");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("survey")
    .setDescription("Send surveys")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("by-role")
        .setDescription("Send surveys by role")
        .addRoleOption((option) =>
          option
            .setName("role")
            .setDescription("name of the role")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("message").setDescription("message").setRequired(true)
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
    ),
  async execute(interaction) {
    const guild = await interaction.client.guilds.cache.get(
      interaction.guildId
    );
    let members = await guild.members.cache.map((member) => member);
    const message = interaction.options.getString("message").replace(/\\n|\\r\\n/g, '\n')
    if (interaction.options._subcommand === "by-role") {
      const role = interaction.options.getRole("role");
      if (role.name === "@everyone")
        members = members.filter(({ user }) => !user.bot)
      else
        members = members.filter(({ roles, user }) => (!user.bot && roles.cache.some((memberRole) => memberRole.name === role.name)))
    } 
    else {
      const since = interaction.options.getString("since");
      const till = interaction.options.getString("till");
      if (till) 
        members = members.filter(({ user, joinedTimestamp }) => (!user.bot && joinedTimestamp < till && joinedTimestamp > since))
      else 
        members = members.filter(({ user, joinedTimestamp }) => (!user.bot && joinedTimestamp > since))
    }
    processMessages(interaction, members, message)
    await interaction.reply({ content: "Surveys sent!", ephemeral: true });
  },
};


function processMessages(interaction, members, message){
  let counter = 0;
  const interval = setInterval(async () => {
    const { roles, id, user } = members[counter];
    const targetUser = await interaction.client.users.fetch(id);
    targetUser
      .send(message)
      .then(() =>
        console.log(
          `Message Sent to ${targetUser.username}#${targetUser.discriminator}`
        )
      )
      .catch((e) => console.error(`Couldn't DM member ${user}`));
    counter++;
    if (counter >= members.length) clearInterval(interval);
  }, 60000);
}