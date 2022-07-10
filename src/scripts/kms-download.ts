import { writeFileSync } from 'fs';
import { downloadPubKey } from './kms-util';

const run = async () => {
  try {
    const { awsAccessKeyID, awsSecretAccessKey } = process.env;
    if (awsAccessKeyID && awsSecretAccessKey) {
      const kmsPubKey = await downloadPubKey(awsAccessKeyID, awsSecretAccessKey);
      writeFileSync('kmsPublicKey.pem', kmsPubKey);
    } else {
      throw new Error('ERROR: Invalid AWS credentials');
    }
    console.log('[kms-download]', 'Success');
  } catch (err) {
    console.log('[kms-download]', err);
  }
};

run();
