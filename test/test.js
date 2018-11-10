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
        '1': {
          'games': {
            'Sample game': {
              'users': {}
            },
          },
        },
      },
    };
  }

  let messages = {};
  let mock_guilds = {
    '1': {
      'defaultChannel': {
        'send': function(msg) {
          messages['1'] = messages['1'] || [];
          messages['1'].push(msg);
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
      this.user = {id: '1', tag: 'mockbot#1'};
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

    it('should subscribe to known games', function(done) {
      let config = MockConfig();
      Bot.create(config, {
        'Discord': {'Client': MockDiscordClient},
        save
      });
      client.dispatch('message', {
        'content': '<@1> subscribe Sample Game',
        'guild': {'id': '1'},
        'member': {'user': {'id': '2'} },
        'reply': function(response) {
          assert.equal(config.guilds['1'].games['Sample game'].users['2'], true);
          done();
        },
      });
    });

    it('should notify subscribed users', function() {
      let config = MockConfig();
      config.guilds['1'].games['Sample game'].users['2'] = true;
      Bot.create(config, {
        'Discord': {'Client': MockDiscordClient},
        save
      });
      let guild = {id: '1'};
      let user = {id: '3'};
      client.dispatch('presenceUpdate',
          {guild, user, 'presence': {'game': null}},
          {guild, user, 'presence': {'game': 'Sample game'}});
      assert.equal(messages['1'].length, 1);
      assert.equal(messages['1'][0].substring(0, 4), '<@2>');
      message = {};
    });
  });
});
