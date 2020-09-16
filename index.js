const fs = require('fs');
const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1');
const { IamAuthenticator } = require('ibm-watson/auth');
const Discord = require('discord.js');
const {prefix, token, iamApiKey, textToSpeechUrl, textToSpeechAuthType} = require('./config.json');

process.env.TEXT_TO_SPEECH_APIKEY = iamApiKey;
process.env.TEXT_TO_SPEECH_IAM_APIKEY = iamApiKey;
process.env.TEXT_TO_SPEECH_URL = textToSpeechUrl;
process.env.TEXT_TO_SPEECH_AUTH_TYPE = textToSpeechAuthType;

const client = new Discord.Client();
client.commands = new Discord.Collection();

const speechToText = new SpeechToTextV1({
    authenticator: new IamAuthenticator({ apikey: iamApiKey }),
    serviceUrl: textToSpeechUrl
});

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.name, command);
}


client.once('ready', () => {
	console.log('Ready!');
});

client.on('message', message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) return;


    if (command.args > 0 && !args.length) {
        return message.reply(`You didn't provide enough arguments! Proper usage would be: ${prefix}${command.name} ${command.usage}`);
    }
    
    if (command.guildOnly && message.channel.type === 'dm') {
        return message.reply('I can\'t execute that command inside DMs!');
    }  

    try {
        command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('There was an error trying to execute that command!');
    }

	console.log(message.content);
});

global.listeningTo = {}; // id: {text_channel, streams, connection}
global.endStream = async function(userId, voiceChannel) {
    stream = global.listeningTo[voiceChannel.id].streams[userId];
    stream.destroy();
    delete global.listeningTo[voiceChannel.id].streams[userId];
};
global.userIds = {};
global.startStream = async function(user, connection, textChannel, language, voiceChannel) {
    if (global.userIds[user.id] === undefined) {
        global.userIds[user.id] = 0;
    } else {
        global.userIds[user.id]++;
    }
    const audio = connection.receiver.createStream(user, { mode: 'pcm' });
    audio.on('end', async () => {
        // The name of the audio file to transcribe
        const fileName = user.id + '' + global.userIds[user.id];

        // Start new stream async
        global.startStream(user, connection, textChannel, language, voiceChannel);

        const params = {
            audio: fs.createReadStream(fileName),
            contentType: 'audio/l16; rate=48000; channels=2',
            model: language
        };
        
        speechToText.recognize(params).then(response => {
            fs.unlinkSync(fileName);
            if (response.result.results.length < 1) {
                return;
            }
            console.log(JSON.stringify(response.result, null, 2));
            textChannel.send(`${user.username}: '${response.result.results[0].alternatives[0].transcript}'`);
        }).catch(err => {
            console.log(err);
            fs.unlinkSync(fileName);
        });
    });
    audio.pipe(fs.createWriteStream(user.id + '' + global.userIds[user.id]));
    global.listeningTo[voiceChannel.id].streams[user.id] = audio;
};
global.stopListening = async function(id) {
    global.listeningTo[id].connection.disconnect();
    delete global.listeningTo[id];
};
global.startListening = async function(textChannel, voiceChannel, language, message) {
    global.listeningTo[voiceChannel.id] = {};
    global.listeningTo[voiceChannel.id].model = undefined;
    if (language === 'nl-nl') {
        global.listeningTo[voiceChannel.id].model = SpeechToTextV1.RecognizeConstants.Model.NL_NL_BROADBANDMODEL;
    } else if (language === 'en-gb') {
        global.listeningTo[voiceChannel.id].model = SpeechToTextV1.RecognizeConstants.Model.EN_GB_BROADBANDMODEL;
    } else if (language === 'en-us') {
        global.listeningTo[voiceChannel.id].model = SpeechToTextV1.RecognizeConstants.Model.EN_US_BROADBANDMODEL;    
    }
    if (global.listeningTo[voiceChannel.id].model === undefined) {
        delete global.listeningTo[voiceChannel.id];
        message.reply("I don't understand this language. Please pick one of the following: 'en-gb', 'en-us', 'nl-nl'.")
        return;
    }
    global.listeningTo[voiceChannel.id].connection = await voiceChannel.join();
    global.listeningTo[voiceChannel.id].textChannel = textChannel;
    global.listeningTo[voiceChannel.id].streams = {};
    var connection = global.listeningTo[voiceChannel.id].connection;
    var model = global.listeningTo[voiceChannel.id].model;
    dispatcher = connection.play('join_sound.mp3', { passes: 5 });
    // dispatcher.pause(true)
    var members = voiceChannel.members.array();
    for (i = 0; i < members.length; i++) {
        if (!members[i].user.bot) {
            global.startStream(members[i].user, connection, textChannel, model, voiceChannel);
        }
    }
    message.channel.send('Providing subtitles!');
};
global.isListeningTo = function(voiceChannel) {
    return global.listeningTo[voiceChannel.id] !== undefined;
};
global.isListeningIn = function(textChannel) {
    for (const key in global.listeningTo) {
        const value = global.listeningTo[key];
        if (value.textChannel.id == message.channel.id) {
            return true; 
        }
    }
    return false;
};


client.on('voiceStateUpdate', (oldMember, newMember) => {
    let newUserChannel = newMember.channel;
    let oldUserChannel = oldMember.channel;
  
    if(oldUserChannel === null && newUserChannel !== null) {
        // User Joins a voice channel
        if (global.isListeningTo(newUserChannel) && !newMember.member.user.bot) {
            // Start stream for user
            user = newMember.member.user;
            connection = global.listeningTo[newUserChannel.id].connection;
            textChannel = global.listeningTo[newUserChannel.id].textChannel;
            model = global.listeningTo[newUserChannel.id].model;
            global.startStream(user, connection, textChannel, model, newUserChannel);
        }
  
    } else if(newUserChannel === null){
        // User leaves a voice channel
        if (global.isListeningTo(oldUserChannel) && !oldMember.member.user.bot) {
            user = oldMember.member.user;
            global.endStream(user.id, oldUserChannel);
            const remainingMembers = oldUserChannel.members.array();
            for (var i = 0; i < remainingMembers.length; i++) {
                var member = remainingMembers[i];
                if (!member.user.bot) {
                    i++
                }
                if (i > 1) {
                    return;
                }
            }
            global.listeningTo[oldUserChannel.id].textChannel.send('There are participants left! Stopped proving subtitles!');
            global.stopListening(oldUserChannel.id);
        }
    }
  });

client.login(token);
