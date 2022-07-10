import { updatePolicy } from './kms-util';

const run = async () => {
  try {
    const { awsAccessKeyID, awsSecretAccessKey } = process.env;
    if (awsAccessKeyID && awsSecretAccessKey) {
      await updatePolicy(awsAccessKeyID, awsSecretAccessKey);
    } else {
      throw new Error('ERROR: Invalid AWS credentials');
    }
    console.log('[kms-update]', 'Success');
  } catch (err) {
    console.log('[kms-update]', err);
  }
};

run();
