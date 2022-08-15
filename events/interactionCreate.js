module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    if (!interaction.isCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) return;

    try {
      if (
        interaction.member.roles.cache.some(
          (memberRole) => memberRole.name === "HealthPulse - Admin"
        )
      )
        await command.execute(interaction);
      else
        await interaction.reply({
          content: "This command available to admins only!",
          ephemeral: true,
        });
    } catch (error) {
      // console.error(error);
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  },
};
