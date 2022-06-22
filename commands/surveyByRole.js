const { SlashCommandBuilder } = require("@discordjs/builders");
var formatDistanceToNow = require("date-fns/formatDistanceToNow");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("survey")
    .setDescription("Send surveys")
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
      const role = interaction.options.getRole("role");
      Members.map(async ({ roles, id, user, joinedTimestamp }) => {
        if (roles.cache.some((memberRole) => memberRole.name === role.name)) {
          const targetUser = await interaction.client.users.fetch(id);
          const message = `Dear ${user}, It's been ${formatDistanceToNow(
            joinedTimestamp
          )} Since you joined to the ${
            guild.name
          }. \n\nWe'd love to hear how things are going!\nYour feedback is important to us!\n\nWe use it to ensure our dao is providing proper direction and to ensure we have the opportunity \nto change our approach to better suit your needs if necessary\n\nPlease use the following link to fill out the survey: 
          \n${link}`;
          targetUser.send(message);
        }
      });
    } else {
      const since = interaction.options.getString("since");
      const till = interaction.options.getString("till");
      Members.map(async ({ id, user, joinedTimestamp }) => {
        const message = `Dear ${user}, It's been ${formatDistanceToNow(
          joinedTimestamp
        )} Since you joined to the ${
          guild.name
        }. \n\nWe'd love to hear how things are going!\nYour feedback is important to us!\n\nWe use it to ensure our dao is providing proper direction and to ensure we have the opportunity \nto change our approach to better suit your needs if necessary\n\nPlease use the following link to fill out the survey: 
        \n${link}`;
        if (!user.bot) {
          if (till) {
            if (joinedTimestamp < till && joinedTimestamp > since) {
              const targetUser = await interaction.client.users.fetch(id);
              console.log(targetUser);
              targetUser.send(message); // 1655729528883 till
            }
          } else {
            if (joinedTimestamp > since) {
              const targetUser = await interaction.client.users.fetch(id);
              console.log(targetUser);
              targetUser.send(message); // 1654087928883 since
            }
          }
        }
      });
    }
    await interaction.reply({ content: "Surveys sent!!!", ephemeral: true });
  },
};
