/* eslint-disable no-console */
const crypto = require('crypto');
const axios = require('axios');
const pLimit = require('p-limit');
const { isValidPhoneNumber } = require('libphonenumber-js');
const corePdfManager = require('pdfjs-dist/lib/core/pdf_manager');
const { Renderer } = require('./renderer');
const { Encryptor } = require('./encryptor');
const { checkSendAPIParams, checkBulkSendAPIParams } = require('./params-checker');

const internalErrorCode = {
  SUCCESS: 0,
  INVALID_TEMPLATE_DATA: 1,
  PWD_PROTECTED_PDF: 2,
  SECURED_PDF: 3,
  SIGNED_PDF: 4,
  EXCEED_SIGNER_LIMIT: 5,
  EXCEED_FIELD_LIMIT: 6,
  EXCEED_PDF_SIZE_LIMIT: 7,
  PHONE_NUMBER_CHECK_FAIL: 8
};
const apiSvrUrl = 'api.letsesign.net';
const apiVer = '1909';
const concurrencyLimit = 5;

class Caller {
  constructor() {
    this.submitTask = async (apiKey, bearerSecret, kmsPublicKey, taskConfig, fieldList, pdfFileName, pdfFileData) => {
      const resp = {
        httpCode: 500,
        errorMsg: 'Undefined error'
      };

      try {
        // 0. check parameters

        // - check parameters with schema
        const checkParamsResult = checkSendAPIParams(taskConfig, fieldList, pdfFileName);
        if (!checkParamsResult.valid) {
          resp.httpCode = 400;
          resp.errorMsg =
            `Invalid parameter: ${checkParamsResult.errors[0].path.join('.')} ` +
            `${checkParamsResult.errors[0].message}`;
          return resp;
        }

        // - check phone number format
        const checkSignerPhoneNumResult = this.checkSignerPhoneNum(taskConfig.signerInfoList);
        if (checkSignerPhoneNumResult.retCode !== internalErrorCode.SUCCESS) {
          resp.httpCode = 400;

          if (checkSignerPhoneNumResult.retCode === internalErrorCode.PHONE_NUMBER_CHECK_FAIL)
            resp.errorMsg = `Invalid parameter: taskConfig.signerInfoList.${checkSignerPhoneNumResult.errorAtIndex}.phoneNumber is not a valid phone number format`;
          else console.error(checkSignerPhoneNumResult);

          return resp;
        }

        // - check PDF
        const pdfFileDataBuffer = Buffer.from(pdfFileData, 'base64');
        const checkTemplateDataResult = this.checkTemplateData(pdfFileDataBuffer);
        if (checkTemplateDataResult.retCode !== internalErrorCode.SUCCESS) {
          resp.httpCode = 400;

          if (checkTemplateDataResult.retCode === internalErrorCode.INVALID_TEMPLATE_DATA)
            resp.errorMsg = 'Invalid parameter: pdfFileData is not a valid PDF';
          else if (checkTemplateDataResult.retCode === internalErrorCode.PWD_PROTECTED_PDF)
            resp.errorMsg = 'Invalid parameter: pdfFileData is a password protected PDF';
          else if (checkTemplateDataResult.retCode === internalErrorCode.SECURED_PDF)
            resp.errorMsg = 'Invalid parameter: pdfFileData is a secured PDF';
          else if (checkTemplateDataResult.retCode === internalErrorCode.SIGNED_PDF)
            resp.errorMsg = 'Invalid parameter: pdfFileData is a signed PDF';
          else console.error(checkTemplateDataResult);

          return resp;
        }

        // - check fieldList
        const internalTemplateInfo = {
          version: '1.1',
          signerList: new Array(taskConfig.signerInfoList.length).fill().map(() => ({ fieldList: [] }))
        };
        for (let fieldIndex = 0; fieldIndex !== fieldList.length; fieldIndex += 1) {
          const fieldData = fieldList[fieldIndex];

          if (fieldData.signerNo >= internalTemplateInfo.signerList.length) {
            resp.httpCode = 400;
            resp.errorMsg = `Invalid parameter: fieldList.${fieldIndex}.signerNo is out of range`;
            return resp;
          }

          internalTemplateInfo.signerList[fieldData.signerNo].fieldList.push({
            pageNo: fieldData.fieldInfo.pageNo,
            x: fieldData.fieldInfo.x,
            y: fieldData.fieldInfo.y,
            height: fieldData.fieldInfo.height,
            type: fieldData.fieldInfo.type
          });
        }
        for (let signerIndex = 0; signerIndex !== internalTemplateInfo.signerList.length; signerIndex += 1) {
          let fieldExist = false;
          const signerFieldList = internalTemplateInfo.signerList[signerIndex].fieldList;

          for (let fieldIndex = 0; fieldIndex !== signerFieldList.length; fieldIndex += 1) {
            if (signerFieldList[fieldIndex].type === 0) {
              fieldExist = true;
              break;
            }
          }

          if (!fieldExist) {
            resp.httpCode = 400;
            resp.errorMsg = `Invalid parameter: the No. ${signerIndex} signer requires at least one signature field`;
            return resp;
          }
        }

        // 1. check with limit config
        const getConfigRes = await this.getConfigApi(apiKey);

        if (getConfigRes.httpCode !== 200) {
          resp.httpCode = getConfigRes.httpCode;
          resp.errorMsg = getConfigRes.errorMsg;

          return resp;
        }

        const checkLitmitResult = this.checkWithLimitConfig(
          getConfigRes.jsonBody,
          taskConfig.signerInfoList,
          internalTemplateInfo.signerList,
          pdfFileDataBuffer,
          false
        );

        if (checkLitmitResult.retCode !== internalErrorCode.SUCCESS) {
          resp.httpCode = 400;

          if (checkLitmitResult.retCode === internalErrorCode.EXCEED_SIGNER_LIMIT)
            resp.errorMsg = `Invalid parameter: length of taskConfig.signerInfoList exceeds the limit (${checkLitmitResult.limitVal})`;
          else if (checkLitmitResult.retCode === internalErrorCode.EXCEED_PDF_SIZE_LIMIT)
            resp.errorMsg = `Invalid parameter: size of pdfFileData exceeds the limit (${checkLitmitResult.limitVal} MB)`;
          else if (checkLitmitResult.retCode === internalErrorCode.EXCEED_FIELD_LIMIT)
            resp.errorMsg = `Invalid parameter: the No. ${checkLitmitResult.errorAtIndex} signer exceeds the field limit per type (${checkLitmitResult.limitVal})`;

          return resp;
        }

        // 2. call internal submit task
        const internalTaskConfig = {
          fileName: pdfFileName,
          senderMsg: taskConfig.options.senderMsg,
          notificantEmail: taskConfig.options.notificantEmail,
          notificantLocale: taskConfig.options.notificantLocale,
          signerInfoList: taskConfig.signerInfoList,
          nonce: crypto.randomBytes(32).toString('hex')
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
          pdfFileDataBuffer
        );
      } catch (err) {
        console.error(err);
        resp.httpCode = 500;
        resp.errorMsg = 'Internal error';
      }

      return resp;
    };

    this.submitBulkTask = async (
      apiKey,
      bearerSecret,
      kmsPublicKey,
      taskConfig,
      fieldList,
      pdfFileName,
      pdfFileData
    ) => {
      const resp = {
        httpCode: 500,
        errorMsg: 'Undefined error',
        response: {
          taskList: []
        }
      };

      try {
        // 0. check parameters

        // - check parameters with schema
        const checkParamsResult = checkBulkSendAPIParams(taskConfig, fieldList, pdfFileName);
        if (!checkParamsResult.valid) {
          resp.httpCode = 400;
          resp.errorMsg =
            `Invalid parameter: ${checkParamsResult.errors[0].path.join('.')} ` +
            `${checkParamsResult.errors[0].message}`;
          return resp;
        }

        // - check phone number format
        const checkSignerPhoneNumResult = this.checkSignerPhoneNum(taskConfig.signerInfoList);
        if (checkSignerPhoneNumResult.retCode !== internalErrorCode.SUCCESS) {
          resp.httpCode = 400;

          if (checkSignerPhoneNumResult.retCode === internalErrorCode.PHONE_NUMBER_CHECK_FAIL)
            resp.errorMsg = `Invalid parameter: taskConfig.signerInfoList.${checkSignerPhoneNumResult.errorAtIndex}.phoneNumber is not a valid phone number format`;
          else console.error(checkSignerPhoneNumResult);

          return resp;
        }

        // - check PDF
        const pdfFileDataBuffer = Buffer.from(pdfFileData, 'base64');
        const checkTemplateDataResult = this.checkTemplateData(pdfFileDataBuffer);
        if (checkTemplateDataResult.retCode !== internalErrorCode.SUCCESS) {
          resp.httpCode = 400;

          if (checkTemplateDataResult.retCode === internalErrorCode.INVALID_TEMPLATE_DATA)
            resp.errorMsg = 'Invalid parameter: pdfFileData is not a valid PDF';
          else if (checkTemplateDataResult.retCode === internalErrorCode.PWD_PROTECTED_PDF)
            resp.errorMsg = 'Invalid parameter: pdfFileData is a password protected PDF';
          else if (checkTemplateDataResult.retCode === internalErrorCode.SECURED_PDF)
            resp.errorMsg = 'Invalid parameter: pdfFileData is a secured PDF';
          else if (checkTemplateDataResult.retCode === internalErrorCode.SIGNED_PDF)
            resp.errorMsg = 'Invalid parameter: pdfFileData is a signed PDF';
          else console.error(checkTemplateDataResult);

          return resp;
        }

        // - check fieldList
        let fieldExist = false;
        const internalTemplateInfo = {
          version: '1.1',
          signerList: [{ fieldList: [] }]
        };
        for (let fieldIndex = 0; fieldIndex !== fieldList.length; fieldIndex += 1) {
          const fieldData = fieldList[fieldIndex];

          if (fieldData.fieldInfo.type === 0) fieldExist = true;

          internalTemplateInfo.signerList[0].fieldList.push({
            pageNo: fieldData.fieldInfo.pageNo,
            x: fieldData.fieldInfo.x,
            y: fieldData.fieldInfo.y,
            height: fieldData.fieldInfo.height,
            type: fieldData.fieldInfo.type
          });
        }
        if (!fieldExist) {
          resp.httpCode = 400;
          resp.errorMsg = `Invalid parameter: bulk signers require at least one signature field`;
          return resp;
        }

        // 1. check with limit config
        const getConfigRes = await this.getConfigApi(apiKey);

        if (getConfigRes.httpCode !== 200) {
          resp.httpCode = getConfigRes.httpCode;
          resp.errorMsg = getConfigRes.errorMsg;

          return resp;
        }

        const checkLitmitResult = this.checkWithLimitConfig(
          getConfigRes.jsonBody,
          taskConfig.signerInfoList,
          internalTemplateInfo.signerList,
          pdfFileDataBuffer,
          false
        );

        if (checkLitmitResult.retCode !== internalErrorCode.SUCCESS) {
          resp.httpCode = 400;

          if (checkLitmitResult.retCode === internalErrorCode.EXCEED_SIGNER_LIMIT)
            resp.errorMsg = `Invalid parameter: length of taskConfig.signerInfoList exceeds the limit (${checkLitmitResult.limitVal})`;
          else if (checkLitmitResult.retCode === internalErrorCode.EXCEED_PDF_SIZE_LIMIT)
            resp.errorMsg = `Invalid parameter: size of pdfFileData exceeds the limit (${checkLitmitResult.limitVal} MB)`;
          else if (checkLitmitResult.retCode === internalErrorCode.EXCEED_FIELD_LIMIT)
            resp.errorMsg = `Invalid parameter: bulk signers exceed the field limit per type (${checkLitmitResult.limitVal})`;

          return resp;
        }

        // 2. submit bulk task
        const limitFn = pLimit(concurrencyLimit);
        const promiseList = taskConfig.signerInfoList.map((signer) => {
          return limitFn(() => {
            const internalTaskConfig = {
              fileName: pdfFileName,
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

            // fill notificant locale
            if (internalTaskConfig.notificantLocale.length === 0) internalTaskConfig.notificantLocale = 'en-US';

            return this.internalSubmitTask(
              apiKey,
              bearerSecret,
              kmsPublicKey,
              false,
              internalTaskConfig,
              internalTemplateInfo,
              pdfFileDataBuffer
            );
          });
        });
        const promiseResultList = await Promise.all(promiseList);

        for (let signerIndex = 0; signerIndex < taskConfig.signerInfoList.length; signerIndex += 1) {
          const taskResult = {
            taskInfo: {
              signerName: taskConfig.signerInfoList[signerIndex].name,
              signerEmailAddr: taskConfig.signerInfoList[signerIndex].emailAddr,
              signerPhoneNumber: ''
            }
          };

          if (
            taskConfig.signerInfoList[signerIndex].phoneNumber &&
            taskConfig.signerInfoList[signerIndex].phoneNumber.length > 0
          )
            taskResult.taskInfo.signerPhoneNumber = taskConfig.signerInfoList[signerIndex].phoneNumber;

          if (promiseResultList[signerIndex].httpCode === 200)
            taskResult.sendResponse = promiseResultList[signerIndex].response;
          else taskResult.errorResponse = { errorMsg: promiseResultList[signerIndex].errorMsg };

          resp.response.taskList.push(taskResult);
        }
        resp.httpCode = 200;
      } catch (err) {
        console.error(err);
        resp.httpCode = 500;
        resp.errorMsg = 'Internal error';
      }

      return resp;
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
        httpCode: 500,
        errorMsg: 'Undefined error',
        response: {
          taskID: null,
          bindingDataHash: null
        }
      };

      try {
        // 0. add text field to PDF
        let internalTemplateData = null;
        try {
          const renderer = new Renderer();
          internalTemplateData = await renderer.renderPDF(internalTaskConfig, internalTemplateInfo, templateData);
        } catch (err) {
          resp.httpCode = 400;
          resp.errorMsg = `Failed to render PDF: ${err.message}`;
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
          resp.httpCode = 409;
          resp.errorMsg = `Failed to encrypt task config`;
          return resp;
        }

        // 3. encrypt template data
        let encryptedTemplateData = null;
        try {
          encryptedTemplateData = await encryptor.encryptTemplateData(internalTemplateData, kmsPublicKey);
        } catch (err) {
          console.error(err);
          resp.httpCode = 409;
          resp.errorMsg = `Failed to encrypt template data`;
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
          resp.httpCode = 409;
          resp.errorMsg = `Failed to encrypt binding data`;
          return resp;
        }

        // 5. call submit task api
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
          resp.httpCode = submitPayloadRes.httpCode;
          resp.errorMsg = submitPayloadRes.errorMsg;
          return resp;
        }

        const putEncryptedTemplateDataRes = await this.putEncryptedTemplateData(
          submitPayloadRes.jsonBody.uploadURL,
          encryptedTemplateData
        );
        if (putEncryptedTemplateDataRes.httpCode !== 200) {
          resp.httpCode = putEncryptedTemplateDataRes.httpCode;
          resp.errorMsg = putEncryptedTemplateDataRes.errorMsg;
          return resp;
        }

        resp.httpCode = 200;
        resp.response.taskID = submitPayloadRes.jsonBody.taskID;
        resp.response.bindingDataHash = bindingDataHash;

        if ('taskPassword' in submitPayloadRes.jsonBody)
          resp.response.taskPassword = submitPayloadRes.jsonBody.taskPassword;
      } catch (err) {
        console.error(err);

        resp.httpCode = 500;
        resp.errorMsg = 'Internal error';
      }

      return resp;
    };

    this.checkTemplateData = (pdfFileDataBuffer) => {
      // check if password proected or secured
      try {
        const tmpPdfMgr = new corePdfManager.LocalPdfManager(
          'dummy',
          this.toArrayBuffer(pdfFileDataBuffer),
          '',
          {},
          ''
        );
        tmpPdfMgr.pdfDocument.parseStartXRef();
        try {
          tmpPdfMgr.pdfDocument.parse();
        } catch (parseErr) {
          if (parseErr.code && parseErr.code === 1) {
            return { retCode: internalErrorCode.PWD_PROTECTED_PDF };
          }
          return { retCode: internalErrorCode.INVALID_TEMPLATE_DATA };
        }

        const { xref } = tmpPdfMgr.pdfDocument;
        if (xref.encrypt !== undefined && xref.encrypt !== null) {
          return { retCode: internalErrorCode.SECURED_PDF };
        }
      } catch (err) {
        console.error(err);
        return { retCode: internalErrorCode.INVALID_TEMPLATE_DATA };
      }

      // check if signed
      try {
        let isSigned = false;
        const pdfStr = pdfFileDataBuffer.toString('utf-8');
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

        if (isSigned) return { retCode: internalErrorCode.SIGNED_PDF };
      } catch (err) {
        console.error(err);
        return { retCode: internalErrorCode.INVALID_TEMPLATE_DATA };
      }

      return { retCode: internalErrorCode.SUCCESS };
    };

    this.checkSignerPhoneNum = (signerInfoList) => {
      for (let signerIndex = 0; signerIndex !== signerInfoList.length; signerIndex += 1) {
        const { phoneNumber } = signerInfoList[signerIndex];
        if (phoneNumber && phoneNumber.length > 0) {
          if (!isValidPhoneNumber(phoneNumber)) {
            return {
              retCode: internalErrorCode.PHONE_NUMBER_CHECK_FAIL,
              errorAtIndex: signerIndex
            };
          }
        }
      }

      return { retCode: internalErrorCode.SUCCESS };
    };

    this.checkWithLimitConfig = (limitConfig, signerInfoList, signerFieldList, pdfFileDataBuffer, isBulk) => {
      const { maxSignerNumber, maxFieldPerType, maxFileSizeInMb, maxBulkSendSignerNumber } = limitConfig;

      if (isBulk) {
        if (signerInfoList.length > maxBulkSendSignerNumber)
          return { retCode: internalErrorCode.EXCEED_SIGNER_LIMIT, limitVal: maxBulkSendSignerNumber };
      } else {
        // eslint-disable-next-line no-lonely-if
        if (signerInfoList.length > maxSignerNumber)
          return { retCode: internalErrorCode.EXCEED_SIGNER_LIMIT, limitVal: maxSignerNumber };
      }

      for (let signerIndex = 0; signerIndex < signerFieldList.length; signerIndex += 1) {
        const signerField = signerFieldList[signerIndex];
        const fieldGroup = {};

        for (let fieldIndex = 0; fieldIndex < signerField.fieldList.length; fieldIndex += 1) {
          const field = signerField.fieldList[fieldIndex];
          const fieldType = field.type.toString();

          if (fieldType in fieldGroup) fieldGroup[fieldType] += 1;
          else fieldGroup[fieldType] = 1;
        }

        const fieldGroupKeys = Object.keys(fieldGroup);
        for (let keyIndex = 0; keyIndex < fieldGroupKeys.length; keyIndex += 1) {
          const fieldType = fieldGroupKeys[keyIndex];

          if (fieldGroup[fieldType] > maxFieldPerType) {
            return {
              retCode: internalErrorCode.EXCEED_FIELD_LIMIT,
              limitVal: maxFieldPerType,
              errorAtIndex: signerIndex
            };
          }
        }
      }

      if (pdfFileDataBuffer.length > maxFileSizeInMb * 1024 * 1024)
        return { retCode: internalErrorCode.EXCEED_PDF_SIZE_LIMIT, limitVal: maxFileSizeInMb };

      return { retCode: internalErrorCode.SUCCESS };
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
        let errorMsg = '';
        if (err.response.headers['content-type'] === 'application/json') {
          if ('errorMsg' in err.response.data) errorMsg = err.response.data.errorMsg;
          else errorMsg = `Failed to call server API: ${JSON.stringify(err.response.data)}`;
        } else errorMsg = err.response.data;

        return {
          httpCode: err.response.status,
          errorMsg
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
        let errorMsg = '';
        if (err.response.headers['content-type'] === 'application/json') {
          if ('errorMsg' in err.response.data) errorMsg = err.response.data.errorMsg;
          else errorMsg = `Failed to call server API: ${JSON.stringify(err.response.data)}`;
        } else errorMsg = err.response.data;

        return {
          httpCode: err.response.status,
          errorMsg
        };
      }
    };

    this.putEncryptedTemplateData = async (uploadURL, encryptedTemplateData) => {
      const headers = {
        'Content-Type': 'application/json'
      };

      try {
        const res = await axios.put(uploadURL, encryptedTemplateData, {
          headers,
          maxContentLength: 40 * 1024 * 1024,
          maxBodyLength: 40 * 1024 * 1024
        });

        return {
          httpCode: res.status,
          textBody: res.data
        };
      } catch (err) {
        let errorMsg = '';
        if (err.response.headers['content-type'] === 'application/json') {
          if ('errorMsg' in err.response.data) errorMsg = err.response.data.errorMsg;
          else errorMsg = `Failed to call server API: ${JSON.stringify(err.response.data)}`;
        } else errorMsg = err.response.data;

        return {
          httpCode: err.response.status,
          errorMsg
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
