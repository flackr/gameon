const assert = require('assert');

const Bot = require('../bot.js');

describe('bot', function() {

  let save = function(config) {
  }

  let onlogin = undefined;

  function MockConfig() {
    return {
      token: 'my-discord-token',
      guilds: {
        'guild1': {
          'games': {
            'Sample game': {
              'users': {}
            },
            'Other game': {
              'users': {}
            },
            'FUZZY GAME': {
              'users': {}
            },
          },
        },
      },
    };
  }

  let messages = [];
  let mock_guilds = {
    'guild1': {
      'defaultChannel': {
        'send': function(msg) {
          messages.push({'guild': 'guild1', 'content': msg});
        },
      },
    },
  };

  let client = undefined;
  class MockDiscordClient {
    constructor() {
      client = this;
      this.handlers_ = {};
      this.guilds = {
        'get': function(id) {
          return mock_guilds[id];
        },
      };
    }

    login(token) {
      this.user = {id: 'botuser', tag: 'mockbot#1'};
      this.dispatch('ready');
      if (onlogin)
        onlogin(token);
    }

    on(eventType, callback) {
      this.handlers_[eventType] = this.handlers_[eventType] || [];
      this.handlers_[eventType].push(callback);
    }

    dispatch(eventType /*, args */) {
      if (!this.handlers_[eventType])
        return;
      for (let handler of this.handlers_[eventType]) {
        handler.apply(null, Array.prototype.splice.call(arguments, 1));
      }
    }
  }

  const MOCK_HOOKS = {
    'Discord': {'Client': MockDiscordClient},
    save
  }

  function send(guild, from, message) {
    client.dispatch('message', {
      'content': message,
      'guild': {'id': guild},
      'member': {'user': {'id': from}},
      'reply': function(response) {
        client.guilds.get(guild).defaultChannel.send('<@' + from + '>' + response);
      },
      'channel': client.guilds.get(guild).defaultChannel,
    });
  }

  // Sends a subscribe message and returns game in response or false if no
  // game was found.
  function subscribe(guild, user, game) {
    send(guild, user, '<@botuser> subscribe ' + game);
    let response = getMessage();
    assert.ok(response.content.startsWith('<@' + user + '>'));
    let message = response.content.substring(user.length + 3);
    const preamble = 'Subscribed to ';
    if (!message.startsWith(preamble))
      return false;
    // There is an exclamation mark at the end; make sure to remove it.
    return message.substring(preamble.length, message.length - 1);
  }

  // Sends a subscriptions message and returns a list of the games.
  function get_subscriptions(guild, user) {
    send(guild, user, '<@botuser> subscriptions');
    let response = getMessage();
    assert.ok(response.content.startsWith('<@' + user + '>'));
    let message = response.content.substring(user.length + 3);
    if (message.startsWith('You are not'))
      return [];
    const preamble = 'You are subscribed to ';
    assert.ok(message.startsWith(preamble));
    // Parsing the return is made more difficult due to the fancy formatting.
    // Woo for functional testing.
    let game_string = message.substring(preamble.length, message.length);
    let games = game_string.split(/and|,/);
    // In the case where we have A, B, and C, we end up with
    // ['A', ' B', ' ', ' C'], so remove the bad entry.
    games = games.map(o => o.trim()).filter(o => o.length);
    return games;
  }

  function getMessage() {
    assert.equal(messages.length, 1);
    let result = messages[0];
    messages = [];
    return result;
  }

  function getMessages() {
    let result = messages;
    messages = [];
    return result;
  }

  function play(guild, user, game, oldGame) {
    client.dispatch('presenceUpdate',
        {'guild': {'id': guild},
         'user': {'id': user},
         'presence': {'game': oldGame}},
        {'guild': {'id': guild},
         'user': {'id': user},
         'presence': {'game': game}});
  }

  describe('create()', function() {
    it('should connect to discord', function(done) {
      let config = {token: 'foobar'};
      onlogin = function(token) {
        onlogin = undefined;
        assert.equal(token, config.token);
        done();
      };
      Bot.create(config, {
        'Discord': {'Client': MockDiscordClient},
        save
      });
    });
  });

  describe('basic commands', function() {
    it('should respond to the help command', function() {
      let config = MockConfig();
      Bot.create(config, {
        'Discord': {'Client': MockDiscordClient},
        save
      });
      send('guild1', 'user1', '<@botuser> help');
      assert.ok(getMessage().content.startsWith('**Commands:**'));
    });
  });

  describe('subscriptions', function() {
    it('should subscribe to known games', function() {
      let config = MockConfig();
      Bot.create(config, MOCK_HOOKS);
      assert.ok(!config.guilds['guild1'].games['Sample game'].users['user2']);
      assert.equal(subscribe('guild1', 'user2', 'Sample game'), 'Sample game');
      assert.ok(config.guilds['guild1'].games['Sample game'].users['user2']);
    });

    it('should fuzzy match subscribed game', function() {
      Bot.create(MockConfig(), MOCK_HOOKS);
      assert.equal(subscribe('guild1', 'user2', 'FUZY GAME'), 'FUZZY GAME');
    });

    it('should match subscribed games case insensitive', function() {
      Bot.create(MockConfig(), MOCK_HOOKS);
      assert.equal(subscribe('guild1', 'user2', 'SAMPLE GAME'), 'Sample game');
      assert.equal(subscribe('guild1', 'user2', 'fuzzy game'), 'FUZZY GAME');
    });

    it ('should be able to list subscribed games', function() {
      Bot.create(MockConfig(), MOCK_HOOKS);

      assert.equal(get_subscriptions('guild1', 'user2').length, 0);

      assert.equal(subscribe('guild1', 'user2', 'Sample game'), 'Sample game');
      assert.equal(get_subscriptions('guild1', 'user2').length, 1);
      assert.equal(get_subscriptions('guild1', 'user2')[0], 'Sample game');

      // Multiple games are listed alphabetically.
      assert.equal(subscribe('guild1', 'user2', 'Other game'), 'Other game');
      assert.equal(get_subscriptions('guild1', 'user2').length, 2);
      assert.equal(get_subscriptions('guild1', 'user2')[0], 'Other game');
      assert.equal(get_subscriptions('guild1', 'user2')[1], 'Sample game');

      // There is also special formatting for 3 games, so test that too.
      assert.equal(subscribe('guild1', 'user2', 'FUZZY GAME'), 'FUZZY GAME');
      assert.equal(get_subscriptions('guild1', 'user2').length, 3);
      assert.equal(get_subscriptions('guild1', 'user2')[0], 'FUZZY GAME');
      assert.equal(get_subscriptions('guild1', 'user2')[1], 'Other game');
      assert.equal(get_subscriptions('guild1', 'user2')[2], 'Sample game');

    });
  });

  describe('notifications', function() {
    it('should notify subscribed users not playing', function() {
      let config = MockConfig();
      Bot.create(config, MOCK_HOOKS);
      subscribe('guild1', 'user2', 'Sample game');
      subscribe('guild1', 'user3', 'Sample game');
      play('guild1', 'user3', 'Sample game');
      assert.ok(getMessage().content.startsWith('<@user2>:'));
    });

    it('should not notify playing user', function() {
      let config = MockConfig();
      Bot.create(config, MOCK_HOOKS);
      subscribe('guild1', 'user2', 'Sample game');
      play('guild1', 'user2', 'Sample game');
      assert.equal(messages.length, 0);
    });

    it('should only notify on the first playing user per game', function() {
      let config = MockConfig();
      Bot.create(config, MOCK_HOOKS);
      subscribe('guild1', 'user2', 'Sample game');
      subscribe('guild1', 'user2', 'Other game');
      // user3 starting to play should notify
      play('guild1', 'user3', 'Sample game');
      assert.ok(getMessage().content.startsWith('<@user2>:'));

      // user4 starting to play same game should not notify 
      play('guild1', 'user4', 'Sample game');
      assert.equal(messages.length, 0);

      // user5 starting to play another game should notify 
      play('guild1', 'user5', 'Other game');
      assert.ok(getMessage().content.startsWith('<@user2>:'));

      // If everyone stops playing, and user6 starts playing we should get
      // another notification.
      play('guild1', 'user3', null, 'Sample game');
      play('guild1', 'user4', null, 'Sample game');
      play('guild1', 'user6', 'Sample game');
      assert.ok(getMessage().content.startsWith('<@user2>:'));
    });
  });
});
