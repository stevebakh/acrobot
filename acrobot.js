
if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var acronyms = {};

const Botkit = require('botkit');
const controller = Botkit.slackbot({ json_file_store: 'acrobot_db' });
controller.spawn({ token: process.env.token }).startRTM((error, bot, response) => loadData(bot.team_info.id));

function loadData(teamId) {
    controller.storage.teams.get(teamId, (err, data) => {
        if (data !== undefined && data.acronyms !== undefined)
            acronyms = data.acronyms;
    });
}

function normaliseAcronym(acronym) {
    return acronym
        .replace(/\W/g, '')
        .toUpperCase()
}

const directly = ['direct_message', 'mention', 'direct_mention']

controller.hears('ping', directly, (bot, message) => bot.reply(message, 'pong'));

controller.hears([
    /(?:define\s|remember\s)?(?:\W)?([\w\.]+)(?:\W)? (?:as|for|means|stands for) (?:\W)?(.+?)(?:\W)?$/
], directly, (bot, message) => {

    const acronym = normaliseAcronym(message.match[1]);
    const expansion = message.match[2];

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
