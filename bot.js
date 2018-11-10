// See documentation of discord.js API:
// https://discord.js.org/#/docs/main/stable/general/welcome

const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client();
let ping = undefined;
const config_file = 'bot.json';

// Map of game => count of users playing it.
// TODO: Change this to map to count per guild, i.e. if user's in guild A are
// playing a game but not in guild B, guild B user's still need to be notified
// when the first user starts playing it.
let gameCount = {};

// Configuration map:
// {token: '<discord-token>',
//  subscriptions: {game => {guild: {user: true}}}}
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
      configuration.subscriptions[game] = configuration.subscriptions[game] || {};
      configuration.subscriptions[game][msg.guild.id] = configuration.subscriptions[game][msg.guild.id] || {};
      configuration.subscriptions[game][msg.guild.id][msg.member.user.id] = true;
      msg.reply('Subscribed!');
      save();
    } else if (command.substring(0, separator) == 'unsubscribe') {
      delete configuration.subscriptions[game][msg.channel.id][msg.member.user.id];
      msg.reply('Unsubscribed!');
      save();
    }
  }
});

client.on('presenceUpdate', (oldMember, newMember) => {
  let oldGame = oldMember.presence.game;
  let game = newMember.presence.game;
  
  if (oldGame && gameCount[oldGame]) {
    gameCount[oldGame] = Math.max(gameCount[oldGame] - 1, 0);
  }
  if (game) {
    gameCount[game] = gameCount[game] || 0;
    if (gameCount[game] == 0) {
      for (let guild in configuration.subscriptions[game]) {
        // Don't leak information across guilds.
        if (!client.guilds.get(guild).members.get(newMember.user.id))
          continue;
        let messageStr = '';
        for (let user in configuration.subscriptions[game][guild]) {
          if (messageStr)
            messageStr += ', ';
          messageStr += '<@' + user + '>';
        }
        if (!messageStr) continue;
        messageStr += ': people started playing ' + game;
        let defaultChannel = client.guilds.get(guild).defaultChannel;
        defaultChannel.send(messageStr);
      }
    }
    gameCount[game]++;
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

