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

  function send(guild, from, message) {
    client.dispatch('message', {
      'content': message,
      'guild': {'id': guild},
      'member': {'user': {'id': from}},
      'reply': function(response) {
        client.guilds.get(guild).defaultChannel.send('<@' + from + '>' + response);
      },
    });
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

    it('should subscribe to known games', function() {
      let config = MockConfig();
      Bot.create(config, {
        'Discord': {'Client': MockDiscordClient},
        save
      });
      assert.ok(!config.guilds['guild1'].games['Sample game'].users['user2']);
      send('guild1', 'user2', '<@botuser> subscribe Sample Game');
      assert.ok(getMessage().content.startsWith('<@user2>'));
      assert.ok(config.guilds['guild1'].games['Sample game'].users['user2']);
    });

    it('should notify subscribed users not playing', function() {
      let config = MockConfig();
      config.guilds['guild1'].games['Sample game'].users['user2'] = true;
      config.guilds['guild1'].games['Sample game'].users['user3'] = true;
      Bot.create(config, {
        'Discord': {'Client': MockDiscordClient},
        save
      });
      play('guild1', 'user3', 'Sample game');
      assert.ok(getMessage().content.startsWith('<@user2>:'));
    });

    it('should not notify playing user', function() {
      let config = MockConfig();
      config.guilds['guild1'].games['Sample game'].users['user2'] = true;
      Bot.create(config, {
        'Discord': {'Client': MockDiscordClient},
        save
      });
      play('guild1', 'user2', 'Sample game');
      assert.equal(messages.length, 0);
    });
  });
});
