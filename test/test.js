const assert = require('assert');

const Bot = require('../bot.js');

describe('bot', function() {
  describe('create()', function() {
    it('should connect to discord', function(done) {
      let config = {token: 'foobar'};
      let save = function(config) {}
      class MockDiscordClient {
        constructor() {}
        login(token) {
          assert.equal(token, config.token);
          done();
        }
        on(eventType, callback) {}
      }
      Bot.create(config, {
        'Discord': {'Client': MockDiscordClient},
        save
      });
    });
  });
});
