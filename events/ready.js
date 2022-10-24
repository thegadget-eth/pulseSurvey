module.exports = {
	name: 'ready',
	execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);
		
		const time = 3600 * 24 * 1000 * (process.env.RELAUNCH_DATE ?? 1);
		console.log(time)
		setInterval(async () => {
			await client.destroy();
			await client.login(process.env.TOKEN);
			console.log(`Ready! Restarted in as ${client.user.tag}`)
		}, time)
	},
}