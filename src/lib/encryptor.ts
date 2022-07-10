const crypto = require('crypto');

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

export const sha256 = async (data: Buffer | string) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

export const generateAccessKey = async (bearerSecret: any, bindingDataHash: any) => {
  return Buffer.from(await sha256(`${bearerSecret}${bindingDataHash}`), 'hex').toString('base64');
};

export const encryptTaskConfig = async (taskConfig: any, kmsPublicKey: any) => {
  const encryptedTaskConfig = await encryptData(
    Buffer.from(
      JSON.stringify({
        taskConfig
      })
    ),
    kmsPublicKey
  );

  return encryptedTaskConfig;
};

export const encryptTemplateData = async (templateData: any, kmsPublicKey: any) => {
  const encryptedTemplateData = await encryptData(templateData, kmsPublicKey);

  return encryptedTemplateData;
};

export const encryptBindingData = async (
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

  const encryptedBindingData = await encryptData(
    Buffer.from(
      JSON.stringify({
        bindingData
      })
    ),
    kmsPublicKey
  );

  return encryptedBindingData;
};
