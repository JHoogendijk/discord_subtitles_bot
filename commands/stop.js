module.exports = {
    name: 'stop',
    description: 'Stop providing subtitles in the current text channel',
    args: 0,
    usage: '',
    guildOnly: true,
    aliases: [],
    execute(message, args) {
        voiceChannelId = undefined;
        for (const key in global.listeningTo) {
            const value = global.listeningTo[key];
            if (value.textChannel.id == message.channel.id) {
                voiceChannelId = key;
            }
        }
        if (!voiceChannelId) {
            message.reply('I\'m not listening to any channels right now');
            return;
        }
        global.stopListening(voiceChannelId);
        message.channel.send('Stopped proving subtitles');
    },
}

