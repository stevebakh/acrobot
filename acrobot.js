
if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var acronyms = {};

var listening = new Set();

var stopWords = [
    "AND",
    "THE",
    "IT",
    "AS",
    "AN"
];

const entities = require('entities');
const Botkit = require('botkit');
const controller = Botkit.slackbot({ json_file_store: 'acrobot_db' });
controller.spawn({ token: process.env.token }).startRTM((error, bot, response) => loadData(bot));

function loadData(bot) {
    controller.storage.teams.get(bot.team_info.id, (err, data) => {
        if (data !== undefined && data.acronyms !== undefined)
            acronyms = data.acronyms;
    });

    controller.storage.channels.all((error, channels) => {
        for (var channel of channels)
            if (channel.listen) listening.add(channel.id);
    });
}

function normaliseAcronym(acronym) {
    return acronym
        .replace(/\W/g, '')
        .toUpperCase()
}

const directly = ['direct_message', 'mention', 'direct_mention'];

controller.hears('ping', directly, (bot, message) => bot.reply(message, 'pong'));

controller.hears([
    /(?:\W)?([A-Za-z0-9\.]+)(?:\W)? (?:is|means|stands for) (?:\W)?(.+?)(?:\W)?$/
], directly, (bot, message) => {

    const acronym = normaliseAcronym(message.match[1]);
    const expansion = entities.decodeHTML(message.match[2]);

    if (acronyms.hasOwnProperty(acronym)) {
        console.log(`Acronym '${acronym}' already defined!`);
        bot.reply(message, `Sorry! '${acronym}' has already been defined!`);
    } else {
        console.log(`User saved acronym: '${acronym}' for '${expansion}'`);
        acronyms[acronym] = expansion;
        controller.storage.teams.save({ id: message.team, acronyms });
        bot.reply(message, 'Oooh, a new acronym! Thanks!');
    }
});

controller.hears([
    /what(?:[^\w]|\si)s the meaning of ([\w\.]+)\b/,
    /what(?:[^\w]|\si)s ([\w\.]+)\b/,
    /what does (.+) (?:mean|stand for)\b/
], directly, (bot, message) => {

    const acronym = normaliseAcronym(message.match[1]);
    console.log(`User requested expansion of acronym: '${acronym}'`);

    if (acronyms.hasOwnProperty(acronym)) {
        bot.reply(message, `'${acronym}' stands for '${acronyms[acronym]}'`);
    } else {
        console.log(`Acronym '${acronym}' not found.`);
        bot.reply(message, 'Well, this is a bit embarrassing... I\'m afraid I don\'t know that one, but you can teach me!');
    }
});

controller.hears([/(start|stop|are you) listening/], ['mention', 'direct_mention'], (bot, message) => {

    const request = message.match[1].toLowerCase();
    const channel = message.channel;

    if (request == 'start') {
        console.log(`Start listening on channel ID: ${channel}`);
        listening.add(channel);
        controller.storage.channels.save({ id: channel, listen: true });
    } else if (request == 'stop') {
        console.log(`Stop listening on channel ID: ${channel}`);
        listening.delete(channel);
        controller.storage.channels.save({id: channel, listen: false});
    } else if (request == 'are you') {
        bot.reply(message, listening.has(message.channel) ?
            'Yep, I\'m listening.' : 'No, I\'m not listening.');
    } else {
        console.log(`Unknown action '${request}'`);
        bot.reply(message, 'Sorry, I don\'t understand what you mean.');
    }
});

controller.on('ambient', (bot, message) => {

    if (listening.has(message.channel)) {
        const tokenised = message.text.replace(/['",\.;:\?\(\)]/g, '').split(/\s/);
        const matched = tokenised.filter(part =>
            part.match(/^[A-Z]{2,}$/) &&
            acronyms.hasOwnProperty(part) &&
            !stopWords.includes(part));

        if (matched.length > 0) {
            const maybePlural = matched.length > 1 ? 's' : '';
            var response = `Acronym${maybePlural} detected!`;
            matched.forEach(acronym => response += `\n'${acronym}' means '${acronyms[acronym]}.'`);
            bot.reply(message, response);
        }
    }
});
