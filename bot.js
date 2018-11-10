// See documentation of discord.js API:
// https://discord.js.org/#/docs/main/stable/general/welcome

const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client();
let ping = undefined;
const config_file = 'bot.json';

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

client.on('message', msg => {
  if (msg.content.startsWith(ping)) {
    let command = msg.content.substring(ping.length).trim();
    let separator = command.indexOf(' ');
    if (separator == -1)
      return;
    if (command.substring(0, separator) == 'subscribe') {
      let game = command.substring(separator + 1);
      configuration.guilds[msg.guild.id] = configuration.guilds[msg.guild.id] || {"games": {}};
      configuration.guilds[msg.guild.id].games[game] = configuration.guilds[msg.guild.id].games[game] || {};
      configuration.guilds[msg.guild.id].games[game][msg.member.user.id] = true;
      msg.reply('Subscribed!');
      save();
    } else if (command.substring(0, separator) == 'unsubscribe') {
      let game = command.substring(separator + 1);
      delete configuration.guilds[msg.guild.id].games[game][msg.member.user.id];
      msg.reply('Unsubscribed!');
      save();
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
    if (gameCount[newMember.guild.id][game] == 0 &&
        configuration.guilds[guild] &&
        configuration.guilds[guild].games[game]) {
      let messageStr = '';
      for (let user in configuration.guilds[guild].games[game]) {
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
  fs.writeFile(config_file, JSON.stringify(configuration, null, 2));
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

