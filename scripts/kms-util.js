/* eslint-disable no-console */

const aws = require('aws-sdk');

const generatePolicy = require('./kms-generate-policy');

const LETSESIGN_KMS_KEY_ALIAS = 'alias/letsesign-default';

const splitString = (str, maxLength) => {
  if (str.length <= maxLength) return str;
  const reg = new RegExp(`.{1,${maxLength}}`, 'g');
  const parts = str.match(reg);
  return parts.join('\n');
};

const getKMSKeyList = async (kmsClient) => {
  try {
    const retObj = await kmsClient.listAliases({}).promise();

    return retObj.Aliases;
  } catch (err) {
    console.log(err);
    throw new Error('ERROR: failed to list KMS key');
  }
};

const createKMSKey = async (kmsClient) => {
  try {
    const retObj = await kmsClient
      .createKey({
        KeySpec: 'RSA_2048',
        KeyUsage: 'ENCRYPT_DECRYPT'
      })
      .promise();

    return retObj.KeyMetadata;
  } catch (err) {
    console.log(err);
    throw new Error('ERROR: failed to create KMS key');
  }
};

const setKMSKeyAlias = async (kmsClient, keyArn) => {
  try {
    await kmsClient
      .createAlias({
        AliasName: LETSESIGN_KMS_KEY_ALIAS,
        TargetKeyId: keyArn
      })
      .promise();
  } catch (err) {
    console.log(err);
    throw new Error('ERROR: failed to set alias for KMS key');
  }
};

const updateKMSKeyPolicy = async (kmsClient, keyArn) => {
  try {
    await kmsClient
      .putKeyPolicy({
        KeyId: keyArn,
        Policy: generatePolicy.generateKMSPolicy(keyArn),
        PolicyName: 'default'
      })
      .promise();
  } catch (err) {
    console.log(err);
    throw new Error('ERROR: failed to update KMS key policy');
  }
};

const getKMSPubKey = async (kmsClient, keyArn) => {
  try {
    const retObj = await kmsClient
      .getPublicKey({
        KeyId: keyArn
      })
      .promise();

    return `-----BEGIN PUBLIC KEY-----\n${splitString(
      retObj.PublicKey.toString('base64'),
      64
    )}\n-----END PUBLIC KEY-----\n`;
  } catch (err) {
    console.log(err);
    throw new Error('ERROR: failed to get KMS public key');
  }
};

const findDefaultKey = async (kmsClient) => {
  let kmsKeyId = null;
  let kmsKeyArn = null;
  let kmsKeyExist = false;
  let awsAccountId = null;
  const kmsKeyList = await getKMSKeyList(kmsClient);

  // find letsesign-default KMS key
  for (let aliasIndex = 0; aliasIndex < kmsKeyList.length; aliasIndex += 1) {
    const aliasKey = kmsKeyList[aliasIndex];

    if (aliasKey.AliasName === LETSESIGN_KMS_KEY_ALIAS) {
      kmsKeyId = aliasKey.TargetKeyId;
      // eslint-disable-next-line prefer-destructuring
      awsAccountId = aliasKey.AliasArn.split(':')[4];
      kmsKeyArn = `arn:aws:kms:us-east-1:${awsAccountId}:key/${kmsKeyId}`;
      kmsKeyExist = true;
      break;
    }
  }

  if (kmsKeyExist) return kmsKeyArn;

  return null;
};

const setupKey = async (awsAccessKeyID, awsSecretAccessKey) => {
  const kmsClient = new aws.KMS({
    region: 'us-east-1',
    credentials: { accessKeyId: awsAccessKeyID, secretAccessKey: awsSecretAccessKey }
  });

  // check KMS key
  let kmsPubKey = null;
  let kmsKeyArn = await findDefaultKey(kmsClient);

  // crate KMS key if default key is not exist
  if (kmsKeyArn === null) {
    const newKmsKey = await createKMSKey(kmsClient);

    kmsKeyArn = newKmsKey.Arn;

    await setKMSKeyAlias(kmsClient, kmsKeyArn);
  }

  // updae KMS key policy
  await updateKMSKeyPolicy(kmsClient, kmsKeyArn);

  // get KMS public key
  kmsPubKey = await getKMSPubKey(kmsClient, kmsKeyArn);

  return {
    kmsKeyArn,
    kmsPubKey
  };
};

const updatePolicy = async (awsAccessKeyID, awsSecretAccessKey) => {
  const kmsClient = new aws.KMS({
    region: 'us-east-1',
    credentials: { accessKeyId: awsAccessKeyID, secretAccessKey: awsSecretAccessKey }
  });

  // check KMS key
  const kmsKeyArn = await findDefaultKey(kmsClient);

  if (kmsKeyArn === null) throw new Error(`ERROR: can't find KMS key with letsesign-default alias`);

  // updae KMS key policy
  await updateKMSKeyPolicy(kmsClient, kmsKeyArn);
};

const downloadPubKey = async (awsAccessKeyID, awsSecretAccessKey) => {
  const kmsClient = new aws.KMS({
    region: 'us-east-1',
    credentials: { accessKeyId: awsAccessKeyID, secretAccessKey: awsSecretAccessKey }
  });

  // check KMS key
  let kmsPubKey = null;
  const kmsKeyArn = await findDefaultKey(kmsClient);

  if (kmsKeyArn === null) throw new Error(`ERROR: can't find KMS key with letsesign-default alias`);

  kmsPubKey = await getKMSPubKey(kmsClient, kmsKeyArn);

  return kmsPubKey;
};

module.exports = {
  setupKey,
  updatePolicy,
  downloadPubKey
};
