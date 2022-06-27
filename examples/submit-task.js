/* eslint-disable no-console */
const { join } = require('path');
const { inspect } = require('util');
const { readFileSync } = require('fs');
const axios = require('axios');

// Load configurations

const configDir = join(__dirname, 'task-data');
const jsonConfig = JSON.parse(readFileSync(join(configDir, 'submit-task.json')).toString('utf-8'));
const templateInfo = JSON.parse(readFileSync(join(configDir, 'templateInfo.json')).toString('utf-8'));
const templateData = readFileSync(join(configDir, 'templateData.bin')).toString('base64');

// Make API call

const proc = async () => {
  const result = await axios.post('http://localhost/submit-task', {
    taskConfig: jsonConfig.taskConfig,
    templateInfo,
    templateData
  });

  return result.data;
};

proc()
  .then((result) => {
    console.log(inspect(result, { depth: null }));
  })
  .catch((error) => {
    console.error(error);
  });
