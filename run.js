const fs = require('fs');
const Bot = require('./bot.js');
const Discord = require('discord.js');
const CONFIG_FILE = 'bot.json';


function save(configuration) {
  fs.writeFile(CONFIG_FILE, JSON.stringify(configuration, null, 2), null, (err) => {
    if (err)
      console.error('Error saving configuration');
  });
};
fs.readFile(CONFIG_FILE, (err, data) => {
  if (err) {
    console.log('Error: No configuration file.');
    console.log('Write one with at least {"token": "your-token"}');
  } else {
    let configuration = JSON.parse(data);
    console.log('Configuration loaded');
    // Rewrite the config file to pretty-print handcoded config.
    save(configuration);

    Bot.create(configuration, /* hooks = */ {
      Discord,
      save, 
    });
  }
});

