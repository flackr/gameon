// See documentation of discord.js API:
// https://discord.js.org/#/docs/main/stable/general/welcome

const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client();
let ping = undefined;
const config_file = 'bot.json';
const Levenshtein = require('./levenshtein.js');
const MAX_DISTANCE = 4;

// Map of guild => game => count of users playing it.
let gameCount = {};

// Configuration map:
// {token: '<discord-token>',
//  guilds: {guild: {game => {user: true}}}}
let configuration = {};

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  ping = '<@' + client.user.id + '>';
});

function nearest(guild, query, maxDistance) {
  let closest = undefined;
  let closestDistance = maxDistance + 1;
  for (let game in configuration.guilds[guild].games) {
    let dist = Levenshtein.distance(game.toLowerCase(), query.toLowerCase());
    if (dist < closestDistance) {
      closest = game;
      closestDistance = dist;
    }
  }
  return closest;
}

client.on('message', msg => {
  if (msg.content.startsWith(ping)) {
    let command = msg.content.substring(ping.length).trim();
    let separator = command.indexOf(' ');
    if (separator == -1)
      return;
    configuration.guilds[msg.guild.id] = configuration.guilds[msg.guild.id] || {"games": {}};
    if (command.substring(0, separator) == 'subscribe') {
      let game = nearest(msg.guild.id, command.substring(separator + 1), MAX_DISTANCE);
      if (game) {
        configuration.guilds[msg.guild.id].games[game] = configuration.guilds[msg.guild.id].games[game] || {"users": {}};
        configuration.guilds[msg.guild.id].games[game].users[msg.member.user.id] = true;
        msg.reply('Subscribed to ' + game + '!');
        save();
      } else {
        msg.reply('Sorry, I haven\'t observed this game yet. Please run it and verify the name.');
      }
    } else if (command.substring(0, separator) == 'unsubscribe') {
      let game = nearest(msg.guild.id, command.substring(separator + 1), MAX_DISTANCE);
      if (game) {
        if (configuration.guilds[msg.guild.id].games[game]) {
          delete configuration.guilds[msg.guild.id].games[game].users[msg.member.user.id];
          save();
        }
        msg.reply('Unsubscribed from ' + game + '!');
      } else {
        msg.reply('Sorry, I haven\'t observed this game.');
      }
    }
  }
});

client.on('presenceUpdate', (oldMember, newMember) => {
  let oldGame = oldMember.presence.game;
  let game = newMember.presence.game;
  if (oldGame) {
    if (gameCount[oldMember.guild.id]) {
      if (gameCount[oldMember.guild.id][game])
        gameCount[oldMember.guild.id][game] = Math.max(gameCount[oldMember.guild.id][game] - 1, 0);
    }
  }
  if (game) {
    let guild = newMember.guild.id;
    gameCount[guild] = gameCount[guild] || {};
    gameCount[guild][game] = gameCount[guild][game] || 0;

    // Keep track of known games.
    configuration.guilds[guild] = configuration.guilds[guild] || {"games": {}};
    configuration.guilds[guild].games[game] = configuration.guilds[guild].games[game] || {"users": {}};
    save();
    if (gameCount[newMember.guild.id][game] == 0) {
      let messageStr = '';
      for (let user in configuration.guilds[guild].games[game].users) {
        // Don't notify the user about themselves.
        if (user == newMember.user.id)
          continue;
        if (messageStr)
          messageStr += ', ';
        messageStr += '<@' + user + '>';
      }
      if (messageStr) {
        messageStr += ': people started playing ' + game;
        let defaultChannel = client.guilds.get(guild).defaultChannel;
        defaultChannel.send(messageStr);
      }
    }
    gameCount[guild][game]++;
  }
});

function save() {
  fs.writeFile(config_file, JSON.stringify(configuration, null, 2), null, (err) => {
    if (err)
      console.error('Error saving configuration');
  });
}

fs.readFile(config_file, (err, data) => {
  if (err) {
    console.log('Error: No configuration file.');
    console.log('Write one with at least {"token": "your-token"}');
  } else {
    configuration = JSON.parse(data);
    console.log('Configuration loaded');
    // Rewrite the config file to pretty-print handcoded config.
    save();
    client.login(configuration.token);
  }
});

