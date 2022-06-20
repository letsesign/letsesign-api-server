/* eslint-disable no-console */

const os = require('os');
const fs = require('fs');
const path = require('path');

const kmsUtil = require('./kms-util');

const run = async () => {
  try {
    const letsesignFolder = path.join(os.homedir(), '.letsesign');
    const siteSettingPath = path.join(letsesignFolder, 'siteSetting.json');

    if (!fs.existsSync(siteSettingPath)) {
      throw new Error('ERROR: siteSetting.json is missing');
    }

    const siteSetting = JSON.parse(fs.readFileSync(siteSettingPath).toString('utf-8'));

    if (!('awsAccessKeyID' in siteSetting) || siteSetting.awsAccessKeyID.length === 0) {
      throw new Error('ERROR: invalid awsAccessKeyID in siteSetting.json');
    }

    if (!('awsSecretAccessKey' in siteSetting) || siteSetting.awsSecretAccessKey.length === 0) {
      throw new Error('ERROR: invalid awsSecretAccessKey in siteSetting.json');
    }

    const kmsPubKey = await kmsUtil.downloadPubKey(siteSetting.awsAccessKeyID, siteSetting.awsSecretAccessKey);

    fs.writeFileSync('kmsPublicKey.pem', kmsPubKey);

    console.log('');
    console.log(`Successfully saved as kmsPublicKey.pem in the current directory`);
  } catch (err) {
    console.log(err);
  }
};

run();
