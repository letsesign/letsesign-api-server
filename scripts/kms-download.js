/* eslint-disable no-console */

const fs = require('fs');
const kmsUtil = require('./kms-util');

const run = async () => {
  try {
    const { awsAccessKeyID, awsSecretAccessKey } = process.env;
    if (awsAccessKeyID && awsSecretAccessKey) {
      const kmsPubKey = await kmsUtil.downloadPubKey(awsAccessKeyID, awsSecretAccessKey);
      fs.writeFileSync('kmsPublicKey.pem', kmsPubKey);
    } else {
      throw new Error('ERROR: Invalid AWS credentials');
    }
    console.log('[kms-download]', 'Success');
  } catch (err) {
    console.log('[kms-download]', err);
  }
};

run();
