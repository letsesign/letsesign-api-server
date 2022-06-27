/* eslint-disable no-console */
const crypto = require('crypto');
const axios = require('axios');
const pLimit = require('p-limit');
const { Validator } = require('jsonschema');
const { isValidPhoneNumber } = require('libphonenumber-js');
const corePdfManager = require('pdfjs-dist/lib/core/pdf_manager');
const { Renderer } = require('./renderer');
const { Encryptor } = require('./encryptor');

const errCode = {
  SUCCESS: 0,
  CHECK_PARAMS_SCHEMA_FAIL: 5001,
  INVALID_TEMPLATE_DATA: 5003,
  PWD_PROTECTED_PDF: 5004,
  SECURED_PDF: 5005,
  SIGNED_PDF: 5006,
  EXCEED_SIGNER_LIMIT: 5007,
  EXCEED_FIELD_LIMIT: 5008,
  EXCEED_PDF_SIZE_LIMIT: 5009,
  PHONE_NUMBER_CHECK_FAIL: 5010,
  ADD_PDF_TEXT_FIELD_FAIL: 5011,
  ENCRYPT_TASK_CONFIG_FAIL: 5012,
  ENCRYPT_TEMPLATE_DATA_FAIL: 5013,
  ENCRYPT_BINDING_DATA_FAIL: 5014,
  INVALID_SIGNER_LIST_LENGTH: 5015,
  INVOKE_API_ERROR: 5016,
  SUBMIT_TASK_FAIL: 5017,

  UNDEFINED: 5999
};
const apiSvrUrl = 'api.letsesign.net';
const apiVer = '1909';
const concurrencyLimit = 5;

class Caller {
  constructor() {
    this.submitTask = async (apiKey, bearerSecret, kmsPublicKey, taskConfig, templateInfo, templateData) => {
      const resp = {
        taskID: null,
        bindingDataHash: null,
        retCode: errCode.UNDEFINED
      };

      try {
        // 0. check parameters
        const checkParamsResult = this.checkSubmitTaskParams(
          apiKey,
          bearerSecret,
          kmsPublicKey,
          taskConfig,
          templateInfo,
          templateData,
          false
        );
        if (!checkParamsResult.valid) {
          console.error(`Invalid parameter: ${checkParamsResult.errors[0].stack}`);
          resp.retCode = errCode.CHECK_PARAMS_SCHEMA_FAIL;
          return resp;
        }

        if (templateInfo.signerList.length !== taskConfig.signerInfoList.length) {
          console.error('Invalid parameter: signer list length mismatch');
          resp.retCode = errCode.INVALID_SIGNER_LIST_LENGTH;
          return resp;
        }

        if (!Buffer.isBuffer(templateData)) {
          console.error(`Invalid parameter: templateData is not Buffer`);
          resp.retCode = errCode.INVALID_TEMPLATE_DATA;
          return resp;
        }
        const checkTemplateDataResult = this.checkTemplateData(templateData);
        if (checkTemplateDataResult !== 0) {
          resp.retCode = checkTemplateDataResult;
          return resp;
        }

        // 1. check with limit config
        try {
          const limitConfig = await this.getConfig(apiKey);

          if (limitConfig == null) throw new Error('failed to get task config');

          const checkLitmitRet = this.checkWithLimitConfig(
            limitConfig,
            templateInfo,
            templateData,
            taskConfig.signerInfoList,
            false
          );

          if (checkLitmitRet !== errCode.SUCCESS) {
            resp.retCode = checkLitmitRet;
            return resp;
          }
        } catch (err) {
          console.error(err);
          resp.retCode = errCode.INVOKE_API_ERROR;
          return resp;
        }

        // 2. call internal submit task
        const internalTaskConfig = {
          fileName: templateInfo.fileName,
          senderMsg: taskConfig.options.senderMsg,
          notificantEmail: taskConfig.options.notificantEmail,
          notificantLocale: taskConfig.options.notificantLocale,
          signerInfoList: taskConfig.signerInfoList,
          nonce: crypto.randomBytes(32).toString('hex')
        };
        const internalTemplateInfo = {
          version: templateInfo.version,
          signerList: templateInfo.signerList
        };

        // fill notificant locale
        if (internalTaskConfig.notificantLocale.length === 0) internalTaskConfig.notificantLocale = 'en-US';

        return await this.internalSubmitTask(
          apiKey,
          bearerSecret,
          kmsPublicKey,
          taskConfig.options.inOrder,
          internalTaskConfig,
          internalTemplateInfo,
          templateData
        );
      } catch (err) {
        console.error(err);
        resp.retCode = errCode.SUBMIT_TASK_FAIL;
      }

      return resp;
    };

    this.submitBulkTask = async (apiKey, bearerSecret, kmsPublicKey, taskConfig, templateInfo, templateData) => {
      const resp = {
        taskList: [],
        retCode: errCode.UNDEFINED
      };

      try {
        // 0. check parameters
        const checkParamsResult = this.checkSubmitTaskParams(
          apiKey,
          bearerSecret,
          kmsPublicKey,
          taskConfig,
          templateInfo,
          templateData,
          true
        );
        if (!checkParamsResult.valid) {
          console.error(`Invalid parameter: ${checkParamsResult.errors[0].stack}`);
          resp.retCode = errCode.CHECK_PARAMS_SCHEMA_FAIL;
          return resp;
        }

        if (templateInfo.signerList.length !== 1) {
          console.error('Invalid parameter: signer list length must be 1');
          resp.retCode = errCode.INVALID_SIGNER_LIST_LENGTH;
          return resp;
        }

        if (!Buffer.isBuffer(templateData)) {
          console.error(`Invalid parameter: templateData is not Buffer`);
          resp.retCode = errCode.INVALID_TEMPLATE_DATA;
          return resp;
        }
        const checkTemplateDataResult = this.checkTemplateData(templateData);
        if (checkTemplateDataResult !== 0) {
          resp.retCode = checkTemplateDataResult;
          return resp;
        }

        // 1. check with limit config
        try {
          const limitConfig = await this.getConfig(apiKey);

          if (limitConfig == null) throw new Error('failed to get task config');

          const checkLitmitRet = this.checkWithLimitConfig(
            limitConfig,
            templateInfo,
            templateData,
            taskConfig.signerInfoList,
            true
          );

          if (checkLitmitRet !== errCode.SUCCESS) {
            resp.retCode = checkLitmitRet;
            return resp;
          }
        } catch (err) {
          console.error(err);
          resp.retCode = errCode.INVOKE_API_ERROR;
          return resp;
        }

        // 2. submit bulk task
        const limitFn = pLimit(concurrencyLimit);
        const promiseList = taskConfig.signerInfoList.map((signer) => {
          return limitFn(() => {
            const internalTaskConfig = {
              fileName: templateInfo.fileName,
              senderMsg: taskConfig.options.senderMsg,
              notificantEmail: taskConfig.options.notificantEmail,
              notificantLocale: taskConfig.options.notificantLocale,
              signerInfoList: [
                {
                  name: signer.name,
                  emailAddr: signer.emailAddr,
                  locale: signer.locale,
                  ...(signer.phoneNumber && { phoneNumber: signer.phoneNumber })
                }
              ],
              nonce: crypto.randomBytes(32).toString('hex')
            };
            const internalTemplateInfo = {
              version: templateInfo.version,
              signerList: templateInfo.signerList
            };

            // fill notificant locale
            if (internalTaskConfig.notificantLocale.length === 0) internalTaskConfig.notificantLocale = 'en-US';

            return this.internalSubmitTask(
              apiKey,
              bearerSecret,
              kmsPublicKey,
              false,
              internalTaskConfig,
              internalTemplateInfo,
              templateData
            );
          });
        });
        const promiseResultList = await Promise.all(promiseList);

        for (let signerIndex = 0; signerIndex < taskConfig.signerInfoList.length; signerIndex += 1) {
          resp.taskList.push({
            signerInfo: taskConfig.signerInfoList[signerIndex],
            result: promiseResultList[signerIndex]
          });
        }

        resp.retCode = errCode.SUCCESS;
      } catch (err) {
        console.error(err);
        resp.retCode = errCode.SUBMIT_TASK_FAIL;
      }

      return resp;
    };

    this.getConfig = async (apiKey) => {
      const getConfigRes = await this.getConfigApi(apiKey);

      if (getConfigRes.httpCode === 200) return getConfigRes.jsonBody;

      if ('code' in getConfigRes.jsonBody) console.error(getConfigRes.jsonBody.code);
      else console.error(getConfigRes.jsonBody);

      return null;
    };

    this.internalSubmitTask = async (
      apiKey,
      bearerSecret,
      kmsPublicKey,
      inOrder,
      internalTaskConfig,
      internalTemplateInfo,
      templateData
    ) => {
      const resp = {
        taskID: null,
        bindingDataHash: null,
        retCode: errCode.UNDEFINED
      };

      try {
        // 0. add text field to PDF
        let internalTemplateData = null;
        try {
          const renderer = new Renderer();
          internalTemplateData = await renderer.renderPDF(internalTaskConfig, internalTemplateInfo, templateData);
        } catch (err) {
          console.error(err);
          resp.retCode = errCode.ADD_PDF_TEXT_FIELD_FAIL;
          return resp;
        }

        // 1. generate hash
        const encryptor = new Encryptor();
        const taskConfigHash = await encryptor.sha256(JSON.stringify(internalTaskConfig));
        const templateInfoHash = await encryptor.sha256(JSON.stringify(internalTemplateInfo));
        const templateDataHash = await encryptor.sha256(internalTemplateData);
        const bindingDataHash = await encryptor.sha256(
          JSON.stringify({ inOrder, taskConfigHash, templateInfoHash, templateDataHash })
        );

        // 2. encrypt task config
        let encryptedTaskConfig = null;
        try {
          encryptedTaskConfig = await encryptor.encryptTaskConfig(internalTaskConfig, kmsPublicKey);
        } catch (err) {
          console.error(err);
          resp.retCode = errCode.ENCRYPT_TASK_CONFIG_FAIL;
          return resp;
        }

        // 3. encrypt template data
        let encryptedTemplateData = null;
        try {
          encryptedTemplateData = await encryptor.encryptTemplateData(internalTemplateData, kmsPublicKey);
        } catch (err) {
          console.error(err);
          resp.retCode = errCode.ENCRYPT_TEMPLATE_DATA_FAIL;
          return resp;
        }

        // 4. encrypt binding data
        const taskAccessKey = await encryptor.generateAccessKey(bearerSecret, bindingDataHash);
        let encryptedBindingData = null;
        try {
          encryptedBindingData = await encryptor.encryptBindingData(
            inOrder,
            taskConfigHash,
            templateInfoHash,
            templateDataHash,
            taskAccessKey,
            bearerSecret,
            kmsPublicKey
          );
        } catch (err) {
          console.error(err);
          resp.retCode = errCode.ENCRYPT_BINDING_DATA_FAIL;
          return resp;
        }

        // 5. call submit task api
        try {
          const payload = {
            publicTaskInfo: {
              inOrder,
              templateInfo: internalTemplateInfo
            },
            privateTaskInfo: {
              encryptedTaskConfig,
              encryptedBindingData
            }
          };
          const submitPayloadRes = await this.submitPayloadApi(apiKey, payload);
          if (submitPayloadRes.httpCode !== 200) {
            if ('code' in submitPayloadRes.jsonBody) {
              resp.retCode = submitPayloadRes.jsonBody.code;
              return resp;
            }

            throw new Error(submitPayloadRes.jsonBody);
          }

          const putEncryptedTemplateDataRes = await this.putEncryptedTemplateData(
            submitPayloadRes.jsonBody.uploadURL,
            encryptedTemplateData
          );
          if (putEncryptedTemplateDataRes.httpCode !== 200) {
            throw putEncryptedTemplateDataRes.textBody;
          }

          if ('taskPassword' in submitPayloadRes.jsonBody) resp.password = submitPayloadRes.jsonBody.taskPassword;

          resp.taskID = submitPayloadRes.jsonBody.taskID;
          resp.bindingDataHash = bindingDataHash;
          resp.retCode = errCode.SUCCESS;
        } catch (err) {
          console.error(err);
          resp.retCode = errCode.INVOKE_API_ERROR;
          return resp;
        }
      } catch (err) {
        console.error(err);
        resp.retCode = errCode.SUBMIT_TASK_FAIL;
      }

      return resp;
    };

    this.checkSubmitTaskParams = (
      apiKey,
      bearerSecret,
      kmsPublicKey,
      taskConfig,
      templateInfo,
      templateData,
      isBulk
    ) => {
      const schema = {
        type: 'object',
        properties: {
          apiKey: { type: 'string', minLength: 1 },
          bearerSecret: { type: 'string', minLength: 1 },
          kmsPublicKey: {
            type: 'string',
            minLength: 1,
            pattern: '^-----BEGIN PUBLIC KEY-----'
          },
          taskConfig: {
            type: 'object',
            properties: {
              options: {
                type: 'object',
                properties: {
                  inOrder: { type: 'boolean' },
                  senderMsg: { type: 'string' },
                  notificantEmail: {
                    type: 'string',
                    oneOf: [{ enum: [''] }, { format: 'email' }]
                  },
                  notificantLocale: { type: 'string' }
                },
                required: [...(isBulk ? [] : ['inOrder']), 'senderMsg', 'notificantEmail', 'notificantLocale']
              },
              signerInfoList: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', minLength: 1 },
                    emailAddr: { type: 'string', format: 'email' },
                    locale: { type: 'string', minLength: 1 },
                    phoneNumber: { type: 'string' }
                  },
                  required: ['name', 'emailAddr', 'locale']
                },
                minItems: 1
              }
            },
            required: ['options', 'signerInfoList']
          },
          templateInfo: {
            type: 'object',
            properties: {
              fileName: { type: 'string', minLength: 1 },
              signerList: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    fieldList: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          x: { type: 'number' },
                          y: { type: 'number' },
                          height: { type: 'number' },
                          pageNo: { type: 'number' },
                          type: { type: 'number' }
                        },
                        required: ['x', 'y', 'height', 'pageNo', 'type']
                      },
                      minItems: 1
                    }
                  },
                  required: ['fieldList']
                },
                minItems: 1
              }
            },
            required: ['fileName', 'signerList']
          },
          templateData: { type: 'object' }
        },
        required: ['apiKey', 'bearerSecret', 'kmsPublicKey', 'taskConfig', 'templateInfo', 'templateData']
      };
      const params = {
        apiKey,
        bearerSecret,
        kmsPublicKey,
        taskConfig,
        templateInfo,
        templateData
      };
      return new Validator().validate(params, schema);
    };

    this.checkTemplateData = (templateData) => {
      // check if password proected or secured
      try {
        const tmpPdfMgr = new corePdfManager.LocalPdfManager('dummy', this.toArrayBuffer(templateData), '', {}, '');
        tmpPdfMgr.pdfDocument.parseStartXRef();
        try {
          tmpPdfMgr.pdfDocument.parse();
        } catch (parseErr) {
          if (parseErr.code && parseErr.code === 1) {
            return errCode.PWD_PROTECTED_PDF;
          }
          return errCode.INVALID_TEMPLATE_DATA;
        }

        const { xref } = tmpPdfMgr.pdfDocument;
        if (xref.encrypt !== undefined && xref.encrypt !== null) {
          return errCode.SECURED_PDF;
        }
      } catch (err) {
        console.error(err);
        return errCode.SUBMIT_TASK_FAIL;
      }

      // check if signed
      try {
        let isSigned = false;
        const pdfStr = templateData.toString('utf-8');
        const eofIdx = pdfStr.lastIndexOf('%%EOF');
        if (eofIdx !== -1 && pdfStr.length > eofIdx) {
          const extraStr = pdfStr.substring(eofIdx + '%%EOF\n'.length, pdfStr.length).trim();
          const keyValueList = extraStr.split(';');
          let hasLetsEsign = false;
          for (let idx = 0; idx !== keyValueList.length; idx += 1) {
            const kv = keyValueList[idx].split('=');
            if (kv.length === 2) {
              if (kv[0] === 'letsesign' && kv[1] === 'true') {
                hasLetsEsign = true;
                break;
              }
            }
          }
          isSigned = hasLetsEsign;
        }

        if (isSigned) return errCode.SIGNED_PDF;
      } catch (err) {
        console.error(err);
        return errCode.SUBMIT_TASK_FAIL;
      }

      return errCode.SUCCESS;
    };

    this.checkWithLimitConfig = (limitConfig, templateInfo, templateData, signerInfoList, isBulk) => {
      const { maxSignerNumber, maxFieldPerType, maxFileSizeInMb, maxBulkSendSignerNumber, enablePhoneNo } = limitConfig;

      if (isBulk) {
        if (signerInfoList.length > maxBulkSendSignerNumber) return errCode.EXCEED_SIGNER_LIMIT;
      } else {
        // eslint-disable-next-line no-lonely-if
        if (signerInfoList.length > maxSignerNumber) return errCode.EXCEED_SIGNER_LIMIT;
      }

      const fieldGroup = {};
      let isAllValidFieldTypeCount = true;
      for (let signerIndex = 0; signerIndex < templateInfo.signerList.length; signerIndex += 1) {
        const signer = templateInfo.signerList[signerIndex];

        for (let fieldIndex = 0; fieldIndex < signer.fieldList.length; fieldIndex += 1) {
          const field = signer.fieldList[fieldIndex];
          const fieldType = field.type.toString();

          if (fieldType in fieldGroup) fieldGroup[fieldType] += 1;
          else fieldGroup[fieldType] = 1;
        }
      }

      const fieldGroupKeys = Object.keys(fieldGroup);
      for (let keyIndex = 0; keyIndex < fieldGroupKeys.length; keyIndex += 1) {
        const fieldType = fieldGroupKeys[keyIndex];

        if (fieldGroup[fieldType] > maxFieldPerType) {
          isAllValidFieldTypeCount = false;
          break;
        }
      }
      if (isAllValidFieldTypeCount === false) return errCode.EXCEED_FIELD_LIMIT;

      if (templateData.length > maxFileSizeInMb * 1024 * 1024) return errCode.EXCEED_PDF_SIZE_LIMIT;

      let isAllValidPhoneNo = true;
      for (let idx = 0; idx !== signerInfoList.length; idx += 1) {
        const { phoneNumber } = signerInfoList[idx];
        if (phoneNumber && phoneNumber.length > 0) {
          if (enablePhoneNo) {
            if (!isValidPhoneNumber(phoneNumber)) {
              isAllValidPhoneNo = false;
              break;
            }
          } else {
            isAllValidPhoneNo = false;
            break;
          }
        }
      }
      if (isAllValidPhoneNo === false) return errCode.PHONE_NUMBER_CHECK_FAIL;

      return errCode.SUCCESS;
    };

    this.getConfigApi = async (apiKey) => {
      const headers = {
        Accept: 'application/json',
        Authorization: `Basic ${apiKey}`
      };

      try {
        const res = await axios.get(`https://${apiSvrUrl}/${apiVer}/api/get-config`, { headers });

        return {
          httpCode: res.status,
          jsonBody: res.data
        };
      } catch (err) {
        return {
          httpCode: err.response.status,
          jsonBody: err.response.data
        };
      }
    };

    this.submitPayloadApi = async (apiKey, payload) => {
      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${apiKey}`
      };

      try {
        const res = await axios.post(`https://${apiSvrUrl}/${apiVer}/api/submit-task`, payload, { headers });

        return {
          httpCode: res.status,
          jsonBody: res.data
        };
      } catch (err) {
        return {
          httpCode: err.response.status,
          jsonBody: err.response.data
        };
      }
    };

    this.putEncryptedTemplateData = async (uploadURL, encryptedTemplateData) => {
      const headers = {
        'Content-Type': 'application/json'
      };

      try {
        const res = await axios.put(uploadURL, encryptedTemplateData, { headers });

        return {
          httpCode: res.status,
          textBody: res.data
        };
      } catch (err) {
        return {
          httpCode: err.response.status,
          textBody: err.response.data
        };
      }
    };

    this.toArrayBuffer = (nodeBuffer) => {
      return nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength);
    };
  }
}

module.exports = {
  Caller
};
