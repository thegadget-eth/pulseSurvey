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
          option.setName("link").setDescription("survey link").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("by-date")
        .setDescription("Send surveys by date")
        .addStringOption((option) =>
          option.setName("link").setDescription("survey link").setRequired(true)
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
    const Members = await guild.members.cache.map((member) => member);
    const link = interaction.options.getString("link");

    if (interaction.options._subcommand === "by-role") {
      let counter = 0;
      const role = interaction.options.getRole("role");
      const interval = setInterval(async () => {
        const { roles, id, user } = Members[counter];
        const targetUser = await interaction.client.users.fetch(id);
        const message = `Dear ${user},\n\nThis is an official message by RnDAO, in case of doubt, please check the #announcements channel 🙂\n\nWe're testing our newly created pulse-survey bot by inviting you to participate in our research project to identify the Top Challenges in DAOs.\nPlease support this research by voting on problem statements and/or adding your own statements for others to vote on: ${link}\n\nThe results will be published open source in the RnDAO discord and twitter: @RnDAO__`;
        if (role.name === "@everyone") {
          if (!user.bot)
            targetUser
              .send(message)
              .then(() =>
                console.log(
                  `Message Sent to ${targetUser.username}#${targetUser.discriminator}`
                )
              )
              .catch((e) => console.error(`Couldn't DM member ${user}`));
        } else if (
          roles.cache.some((memberRole) => memberRole.name === role.name)
        ) {
          targetUser
            .send(message)
            .then(() =>
              console.log(
                `Message Sent to ${targetUser.username}#${targetUser.discriminator}`
              )
            )
            .catch((e) => console.error(`Couldn't DM member ${user}`));
        }
        counter++;
        if (counter >= Members.length) clearInterval(interval);
      }, 60000);
    } else {
      const since = interaction.options.getString("since");
      const till = interaction.options.getString("till");
      const interval = setInterval(async () => {
        const { id, user, joinedTimestamp } = Members[counter];
        const message = `Dear ${user},\n\nThis is an official message by RnDAO, in case of doubt, please check the #announcements channel 🙂\n\nWe're testing our newly created pulse-survey bot by inviting you to participate in our research project to identify the Top Challenges in DAOs.\nPlease support this research by voting on problem statements and/or adding your own statements for others to vote on: ${link}\n\nThe results will be published open source in the RnDAO discord and twitter: @RnDAO__`;
        if (!user.bot) {
          if (till) {
            if (joinedTimestamp < till && joinedTimestamp > since) {
              const targetUser = await interaction.client.users.fetch(id);
              targetUser
                .send(message)
                .then(() =>
                  console.log(
                    `Message Sent to ${targetUser.username}#${targetUser.discriminator}`
                  )
                )
                .catch((e) => console.error(`Couldn't DM member ${user}`)); // 1655729528883 till
            }
          } else {
            if (joinedTimestamp > since) {
              const targetUser = await interaction.client.users.fetch(id);
              targetUser
                .send(message)
                .then(() =>
                  console.log(
                    `Message Sent to ${targetUser.username}#${targetUser.discriminator}`
                  )
                )
                .catch((e) => console.error(`Couldn't DM member ${user}`)); // 1654087928883 since
            }
          }
        }
        counter++;
        if (counter >= Members.length) clearInterval(interval);
      }, 5000);
    }
    await interaction.reply({ content: "Surveys sent!", ephemeral: true });
  },
};
