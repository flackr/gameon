(function(exports, scope) {

  const Levenshtein = require('./levenshtein.js');
  const MAX_DISTANCE = 4;

  const COMMANDS_LIST = '**Commands:**\n' +
      '`subscribe <game>`: Be notified when someone starts playing `game`\n' +
      '`unsubscribe <game>`: Remove your subscription for `game`';

  class Bot {
    constructor(configuration, hooks) {
      // Configuration map:
      // {token: '<discord-token>',
      //  guilds: {guild: {game => {user: true}}}}
      this.configuration_ = configuration;
      this.hooks_ = hooks;
      this.client_ = new hooks.Discord.Client();
      this.ping_ = undefined;

      // Map of guild => game => count of users playing it.
      this.gameCount_ = {};

      this.client_.on('ready', () => {
        this.ping_ = '<@' + this.client_.user.id + '>';
        this.client_.on('message', this.onMessage.bind(this));
        this.client_.on('presenceUpdate', this.onPresenceUpdate.bind(this));
      });
      this.client_.login(configuration.token);
    }

    nearest(guild, query, maxDistance) {
      let closest = undefined;
      let closestDistance = maxDistance + 1;
      for (let game in this.configuration_.guilds[guild].games) {
        let dist = Levenshtein.distance(game.toLowerCase(), query.toLowerCase());
        if (dist < closestDistance) {
          closest = game;
          closestDistance = dist;
        }
      }
      return closest;
    }

    getSubscriptionListString(guild_id, user_id) {
      // Find all the games that reference this user on this guild.
      this.configuration_.guilds[guild_id] = this.configuration_.guilds[guild_id] || {"games": {}};
      let guild_games = this.configuration_.guilds[guild_id].games
      let games = []
      for (let game_name in guild_games) {
        let game = guild_games[game_name];
        if (game.users && game.users[user_id]) {
          games.push(game_name);
        }
      }

      if (!games.length)
        return 'You are not subscribed to any games.'

      // Sort alphabetically for easier reading.
      games.sort();

      // Format the return string fancy like. Comma-separated with an 'and' for
      // the final component, but skip the comma when there are only two items.
      let game_string = '';
      for (let i = 0; i < games.length; i++) {
        if (i != 0) {
          if (games.length > 2 || i != games.length - 1)
            game_string += ',';
          game_string += ' ';
        }
        if (i > 0 && i == games.length - 1)
          game_string += 'and ';
        game_string += games[i];
      }
      return 'You are subscribed to ' + game_string;
    }

    onMessage(msg) {
      if (msg.content.startsWith(this.ping_)) {
        let command = msg.content.substring(this.ping_.length).trim();
        if (command == 'help') {
          // Deliberately avoid 'reply' here as it creates an ugly large highlight block.
          msg.channel.send(COMMANDS_LIST);
          return;
        } else if (command == 'subscriptions') {
          msg.reply(this.getSubscriptionListString(msg.guild.id, msg.member.user.id));
          return;
        }

        let separator = command.indexOf(' ');
        if (separator == -1)
          return;
        this.configuration_.guilds[msg.guild.id] = this.configuration_.guilds[msg.guild.id] || {"games": {}};
        if (command.substring(0, separator) == 'subscribe') {
          let game = this.nearest(msg.guild.id, command.substring(separator + 1), MAX_DISTANCE);
          if (game) {
            this.configuration_.guilds[msg.guild.id].games[game] = this.configuration_.guilds[msg.guild.id].games[game] || {"users": {}};
            this.configuration_.guilds[msg.guild.id].games[game].users[msg.member.user.id] = true;
            msg.reply('Subscribed to ' + game + '!');
            this.hooks_.save(this.configuration_);
          } else {
            msg.reply('Sorry, I haven\'t observed this game yet. Please run it and verify the name.');
          }
        } else if (command.substring(0, separator) == 'unsubscribe') {
          let game = this.nearest(msg.guild.id, command.substring(separator + 1), MAX_DISTANCE);
          if (game) {
            if (this.configuration_.guilds[msg.guild.id].games[game]) {
              delete this.configuration_.guilds[msg.guild.id].games[game].users[msg.member.user.id];
              this.hooks_.save(this.configuration_);
            }
            msg.reply('Unsubscribed from ' + game + '!');
          } else {
            msg.reply('Sorry, I haven\'t observed this game.');
          }
        }
      }
    }

    onPresenceUpdate(oldMember, newMember) {
      let oldGame = oldMember.presence.game;
      let game = newMember.presence.game;
      if (oldGame) {
        if (this.gameCount_[oldMember.guild.id]) {
          if (this.gameCount_[oldMember.guild.id][oldGame])
            this.gameCount_[oldMember.guild.id][oldGame] = Math.max(this.gameCount_[oldMember.guild.id][oldGame] - 1, 0);
        }
      }
      if (game) {
        let guild = newMember.guild.id;
        this.gameCount_[guild] = this.gameCount_[guild] || {};
        this.gameCount_[guild][game] = this.gameCount_[guild][game] || 0;

        // Keep track of known games.
        this.configuration_.guilds[guild] = this.configuration_.guilds[guild] || {"games": {}};
        this.configuration_.guilds[guild].games[game] = this.configuration_.guilds[guild].games[game] || {"users": {}};
        this.hooks_.save(this.configuration_);
        if (this.gameCount_[newMember.guild.id][game] == 0) {
          let messageStr = '';
          for (let user in this.configuration_.guilds[guild].games[game].users) {
            // Don't notify the user about themselves.
            if (user == newMember.user.id)
              continue;
            if (messageStr)
              messageStr += ', ';
            messageStr += '<@' + user + '>';
          }
          if (messageStr) {
            messageStr += ': people started playing ' + game;
            let defaultChannel = this.client_.guilds.get(guild).defaultChannel;
            defaultChannel.send(messageStr);
          }
        }
        this.gameCount_[guild][game]++;
      }
    }
  }

  exports.create = function(config, hooks) {
    return new Bot(config, hooks);
  }

})(typeof exports === 'undefined' ? this['Bot'] = {} : exports, this);
