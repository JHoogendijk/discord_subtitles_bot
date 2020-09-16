module.exports = { 
    name:'start',
    description: 'Start providing subtitles for the joined voice channel in the current text channel',
    args: 0,
    usage: '[language code (optional, default="en-us")]',
    guildOnly: true,
    aliases: [],
    execute(message, args) {
        voiceChannel = message.member.voice.channel;
        textChannel = message.channel;
        if (!voiceChannel) {
            message.reply(`Please join a voice channel before starting subtitles`);
            return;
        }
        if (global.isListeningTo(voiceChannel)) {
            message.reply('I\'m already listening to this voice channel. Please stop the existing instance first!');
            return;
        }
        if (global.isListeningIn(textChannel)) {
            message.reply('I\'m already sending subtitles to this text channel. Please use another text channel or stop the existing instance first!');
            return;
        }
        if (args.length > 0) {
            languageCode = args[0];
        }
        global.listening = true;
        global.startListening(textChannel, voiceChannel, languageCode, message);
    }
}
