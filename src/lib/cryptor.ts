const crypto = require('crypto');
const aws = require('aws-sdk');

const encryptData = (dataBuffer: Buffer, kmsPubKey: string) => {
  const dataKey = crypto.randomBytes(32);
  const IV = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', dataKey, IV);

  let encryptedData = cipher.update(dataBuffer, 'utf8', 'base64');
  encryptedData += cipher.final('base64');

  const encryptedDataKey = crypto
    .publicEncrypt(
      {
        key: kmsPubKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      dataKey
    )
    .toString('base64');

  const dataIV = IV.toString('base64');

  return {
    encryptedData,
    encryptedDataKey,
    dataIV
  };
};

export const sha256 = (data: Buffer | string) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

export const generateAccessKey = (bearerSecret: any, bindingDataHash: any) => {
  return Buffer.from(sha256(`${bearerSecret}${bindingDataHash}`), 'hex').toString('base64');
};

export const encryptTaskConfig = (taskConfig: any, kmsPublicKey: any) => {
  const encryptedTaskConfig = encryptData(
    Buffer.from(
      JSON.stringify({
        taskConfig
      })
    ),
    kmsPublicKey
  );

  return encryptedTaskConfig;
};

export const encryptTemplateData = (templateData: any, kmsPublicKey: any) => {
  const encryptedTemplateData = encryptData(templateData, kmsPublicKey);

  return encryptedTemplateData;
};

export const encryptBindingData = (
  inOrder: any,
  taskConfigHash: any,
  templateInfoHash: any,
  templateDataHash: any,
  accessKey: any,
  bearerSecret: any,
  kmsPublicKey: any
) => {
  const bindingData = {
    inOrder,
    taskConfigHash,
    templateInfoHash,
    templateDataHash,
    accessKey,
    bearerSecret
  };

  const encryptedBindingData = encryptData(
    Buffer.from(
      JSON.stringify({
        bindingData
      })
    ),
    kmsPublicKey
  );

  return encryptedBindingData;
};

export const decryptData = async (
  awsAccessKeyID: string,
  awsSecretAccessKey: string,
  encryptedData: string,
  encryptedDataKey: string,
  dataIV: string
) => {
  const kmsClient = new aws.KMS({
    region: 'us-east-1',
    credentials: { accessKeyId: awsAccessKeyID, secretAccessKey: awsSecretAccessKey }
  });
  const kmsDecryptRet = await kmsClient
    .decrypt({
      CiphertextBlob: Buffer.from(encryptedDataKey, 'base64'),
      KeyId: 'alias/letsesign-default',
      EncryptionAlgorithm: 'RSAES_OAEP_SHA_256'
    })
    .promise();
  const decipher = crypto.createDecipheriv('aes-256-cbc', kmsDecryptRet.Plaintext, Buffer.from(dataIV, 'base64'));

  let decryptedData = decipher.update(Buffer.from(encryptedData, 'base64'));
  decryptedData = Buffer.concat([decryptedData, decipher.final()]);

  return decryptedData;
};
