const { Validator } = require('jsonschema');
const aws = require('aws-sdk');
const axios = require('axios');

const LETSESIGN_KMS_KEY_ALIAS = 'alias/letsesign-default';

const getTcbInfo = async () => {
  const tcbInfoUrl = 'https://raw.githubusercontent.com/letsesign/letsesign-enclave/main/tcb-info.json';
  try {
    const getResult = await axios.get(tcbInfoUrl);
    return getResult.data;
  } catch (err: any) {
    return {
      error: `Error: ${err.message}`
    };
  }
};

const generateKMSPolicy = async (keyArn: string) => {
  const validateRet = new Validator().validate(keyArn, { type: 'string', pattern: '^arn:aws:kms:us-east-1:' });
  const getMostRecentVersions = (versionList: any[]) => {
    if (versionList.length > 2) {
      const orderedVersionList = versionList.sort((a, b) => a.issueTime - b.issueTime);
      return [orderedVersionList[orderedVersionList.length - 2], orderedVersionList[orderedVersionList.length - 1]];
    }

    return versionList;
  };

  if (validateRet.valid) {
    const iamId = keyArn.split(':')[4];
    const output = {
      Id: 'letsesign-key-policy',
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'Enable IAM User Permissions',
          Effect: 'Allow',
          Principal: {
            AWS: `arn:aws:iam::${iamId}:root`
          },
          Action: 'kms:*',
          Resource: '*',
          Condition: {
            StringEqualsIgnoreCase: {}
          }
        }
      ]
    };

    const tcbInfo = await getTcbInfo();
    if (tcbInfo.error !== null && tcbInfo.error !== undefined) {
      throw new Error(tcbInfo.error);
    }

    const mostRecentVersions = getMostRecentVersions(tcbInfo.versionList);

    for (let versionIndex = 0; versionIndex < mostRecentVersions.length; versionIndex += 1) {
      const versionInfo = mostRecentVersions[versionIndex];

      output.Statement.push({
        Sid: 'Enable enclave data processing',
        Effect: 'Allow',
        Principal: {
          AWS: 'arn:aws:iam::500455354473:user/letsesign-bot'
        },
        Action: 'kms:Decrypt',
        Resource: '*',
        Condition: {
          StringEqualsIgnoreCase: {
            'kms:RecipientAttestation:PCR0': versionInfo.pcrs['0'],
            'kms:RecipientAttestation:PCR1': versionInfo.pcrs['1'],
            'kms:RecipientAttestation:PCR2': versionInfo.pcrs['2']
          }
        }
      });
    }

    return JSON.stringify(output, null, 2);
  }

  throw new Error('ERROR: invalid KMS key ARN format');
};

const splitString = (str: string, maxLength: number) => {
  if (str.length <= maxLength) return str;
  const reg = new RegExp(`.{1,${maxLength}}`, 'g');
  const parts = str.match(reg);
  return parts ? parts.join('\n') : str;
};

const getKMSKeyList = async (kmsClient: any) => {
  try {
    const retObj = await kmsClient.listAliases({}).promise();

    return retObj.Aliases;
  } catch (err) {
    console.log(err);
    throw new Error('ERROR: failed to list KMS key');
  }
};

const createKMSKey = async (kmsClient: any) => {
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

const setKMSKeyAlias = async (kmsClient: any, keyArn: string) => {
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

const updateKMSKeyPolicy = async (kmsClient: any, keyArn: string) => {
  try {
    await kmsClient
      .putKeyPolicy({
        KeyId: keyArn,
        Policy: await generateKMSPolicy(keyArn),
        PolicyName: 'default'
      })
      .promise();
  } catch (err) {
    console.log(err);
    throw new Error('ERROR: failed to update KMS key policy');
  }
};

const getKMSPubKey = async (kmsClient: any, keyArn: string) => {
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

const findDefaultKey = async (kmsClient: any) => {
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

export const setupKey = async (awsAccessKeyID: any, awsSecretAccessKey: any) => {
  const kmsClient = new aws.KMS({
    region: 'us-east-1',
    credentials: { accessKeyId: awsAccessKeyID, secretAccessKey: awsSecretAccessKey }
  });

  // check KMS key
  let kmsPubKey = null;
  let kmsKeyArn = await findDefaultKey(kmsClient);

  // create KMS key if default key does not exist
  if (kmsKeyArn === null) {
    const newKmsKey = await createKMSKey(kmsClient);

    kmsKeyArn = newKmsKey.Arn;

    if (kmsKeyArn) await setKMSKeyAlias(kmsClient, kmsKeyArn);
  }

  // updae KMS key policy
  if (kmsKeyArn) await updateKMSKeyPolicy(kmsClient, kmsKeyArn);

  // get KMS public key
  if (kmsKeyArn) kmsPubKey = await getKMSPubKey(kmsClient, kmsKeyArn);

  return {
    kmsKeyArn,
    kmsPubKey
  };
};

export const updatePolicy = async (awsAccessKeyID: any, awsSecretAccessKey: any) => {
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

export const downloadPubKey = async (awsAccessKeyID: any, awsSecretAccessKey: any) => {
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
