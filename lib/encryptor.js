const { webcrypto } = require('crypto');

class Encryptor {
  constructor() {
    this.encryptTaskConfig = async (taskConfig, kmsPublicKey) => {
      const encryptedTaskConfig = await this.encryptData(
        Buffer.from(
          JSON.stringify({
            taskConfig
          })
        ),
        kmsPublicKey
      );

      return encryptedTaskConfig;
    };

    this.encryptTemplateData = async (templateData, kmsPublicKey) => {
      const encryptedTemplateData = await this.encryptData(templateData, kmsPublicKey);

      return encryptedTemplateData;
    };

    this.encryptEmailConfig = async (emailConfig, bearerSecret, kmsPublicKey) => {
      const encryptedEmailConfig = await this.encryptData(
        Buffer.from(
          JSON.stringify({
            emailConfig,
            bearerSecret
          })
        ),
        kmsPublicKey
      );

      return encryptedEmailConfig;
    };

    this.encryptTwilioConfig = async (twilioConfig, bearerSecret, kmsPublicKey) => {
      const encryptedTwilioConfig = await this.encryptData(
        Buffer.from(
          JSON.stringify({
            twilioConfig,
            bearerSecret
          })
        ),
        kmsPublicKey
      );

      return encryptedTwilioConfig;
    };

    this.encryptBindingData = async (
      inOrder,
      taskConfigHash,
      templateInfoHash,
      templateDataHash,
      accessKey,
      bearerSecret,
      kmsPublicKey
    ) => {
      const bindingData = {
        inOrder,
        taskConfigHash,
        templateInfoHash,
        templateDataHash,
        accessKey,
        bearerSecret
      };

      const encryptedBindingData = await this.encryptData(
        Buffer.from(
          JSON.stringify({
            bindingData
          })
        ),
        kmsPublicKey
      );

      return encryptedBindingData;
    };

    this.sha256 = async (data) => {
      if (typeof data === 'string') {
        return Buffer.from(await webcrypto.subtle.digest('SHA-256', this.toArrayBuffer(Buffer.from(data)))).toString(
          'hex'
        );
      }

      return Buffer.from(await webcrypto.subtle.digest('SHA-256', this.toArrayBuffer(data))).toString('hex');
    };

    this.generateAccessKey = async (bearerSecret, bindingDataHash) => {
      return Buffer.from(await this.sha256(`${bearerSecret}${bindingDataHash}`), 'hex').toString('base64');
    };

    this.encryptData = async (dataBuffer, kmsPublicKey) => {
      const dataKeyInfo = await this.generateAESKey(false);
      const encryptedData = Buffer.from(
        await this.aesEncryptData(dataKeyInfo.keyData, dataKeyInfo.iv, this.toArrayBuffer(dataBuffer))
      ).toString('base64');
      const encryptedDataKey = Buffer.from(
        await this.rsaEncryptData(this.rsaPubKeyToBuffer(kmsPublicKey), await this.exportAESKey(dataKeyInfo.keyData))
      ).toString('base64');
      const dataIV = Buffer.from(dataKeyInfo.iv).toString('base64');

      return {
        encryptedDataKey,
        dataIV,
        encryptedData
      };
    };

    this.generateAESKey = (isExportKey) =>
      new Promise((resolve, reject) => {
        webcrypto.subtle
          .generateKey(
            {
              name: 'AES-CBC',
              length: 256
            },
            true,
            ['encrypt', 'decrypt']
          )
          .then((key) => {
            const iv = webcrypto.getRandomValues(new Uint8Array(16));
            if (isExportKey) {
              webcrypto.subtle
                .exportKey('raw', key)
                .then((keyData) => {
                  resolve({
                    iv,
                    keyData
                  });
                })
                .catch((err) => {
                  reject(err);
                });
            } else {
              resolve({
                iv,
                keyData: key
              });
            }
          })
          .catch((err) => {
            reject(err);
          });
      });

    this.exportAESKey = (key) =>
      new Promise((resolve, reject) => {
        webcrypto.subtle
          .exportKey('raw', key)
          .then((keyData) => {
            resolve(keyData);
          })
          .catch((err) => {
            reject(err);
          });
      });

    this.aesEncryptData = (key, iv, arrayBufferData) =>
      new Promise((resolve, reject) => {
        webcrypto.subtle
          .encrypt(
            {
              name: 'AES-CBC',
              iv
            },
            key,
            arrayBufferData
          )
          .then((encryptedData) => {
            resolve(encryptedData);
          })
          .catch((error) => {
            reject(error);
          });
      });

    this.rsaPubKeyToBuffer = (rsaPemPubKey) => {
      const b64Lines = this.removeLines(rsaPemPubKey);
      const b64Prefix = b64Lines.replace('-----BEGIN PUBLIC KEY-----', '');
      const b64Final = b64Prefix.replace('-----END PUBLIC KEY-----', '');
      const keyBuffer = this.toArrayBuffer(Buffer.from(b64Final, 'base64'));

      return keyBuffer;
    };

    this.rsaEncryptData = (pubKeyBuffer, dataBuffer) =>
      new Promise((resolve, reject) => {
        webcrypto.subtle
          .importKey(
            'spki',
            pubKeyBuffer,
            {
              name: 'RSA-OAEP',
              hash: { name: 'SHA-256' }
            },
            false,
            ['encrypt']
          )
          .then((importedPublicKey) => {
            webcrypto.subtle
              .encrypt(
                {
                  name: 'RSA-OAEP'
                },
                importedPublicKey,
                dataBuffer
              )
              .then((encryptedData) => {
                resolve(encryptedData);
              })
              .catch((err) => {
                reject(err);
              });
          })
          .catch((err) => {
            reject(err);
          });
      });

    this.removeLines = (str) => str.replace(/\n/g, '');

    this.toArrayBuffer = (nodeBuffer) => {
      return nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength);
    };
  }
}

module.exports = {
  Encryptor
};
