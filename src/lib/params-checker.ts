const { Validator } = require('jsonschema');
const { isValidPhoneNumber } = require('libphonenumber-js');
const corePdfManager = require('pdfjs-dist/lib/core/pdf_manager');

export const checkerErrorCode = {
  SUCCESS: 0,
  INVALID_TEMPLATE_DATA: 1,
  PWD_PROTECTED_PDF: 2,
  SECURED_PDF: 3,
  SIGNED_PDF: 4,
  MEET_SIGNER_LIMIT: 5,
  MEET_FIELD_LIMIT: 6,
  MEET_PDF_SIZE_LIMIT: 7,
  PHONE_NUMBER_CHECK_FAIL: 8
};

const signerSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    emailAddr: { type: 'string', format: 'email' },
    locale: { type: 'string', enum: ['en-US', 'zh-TW'] },
    phoneNumber: { type: 'string', maxLength: 100 }
  },
  required: ['name', 'emailAddr', 'locale']
};
const signerInfoListSchema = {
  type: 'array',
  items: signerSchema,
  minItems: 1
};
const fieldSchema = {
  type: 'object',
  properties: {
    signerNo: { type: 'number', minimum: 0 },
    fieldInfo: {
      type: 'object',
      properties: {
        x: { type: 'number', minimum: 0 },
        y: { type: 'number', minimum: 0 },
        height: { type: 'number', minimum: 12, maximum: 64 },
        pageNo: { type: 'number', minimum: 1 },
        type: { type: 'number', enum: [0, 1, 2, 3, 4] }
      },
      required: ['x', 'y', 'height', 'pageNo', 'type']
    }
  },
  required: ['signerNo', 'fieldInfo']
};
const bulkFieldSchema = {
  type: 'object',
  properties: {
    fieldInfo: {
      type: 'object',
      properties: {
        x: { type: 'number', minimum: 0 },
        y: { type: 'number', minimum: 0 },
        height: { type: 'number', minimum: 12, maximum: 64 },
        pageNo: { type: 'number', minimum: 1 },
        type: { type: 'number', enum: [0, 1, 2, 3, 4] }
      },
      required: ['x', 'y', 'height', 'pageNo', 'type']
    }
  },
  required: ['fieldInfo']
};

const toArrayBuffer = (nodeBuffer: any) => {
  return nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength);
};

export const checkSendAPIParams = (taskConfig: any, fieldList: any, pdfFileName: any, isPreview: any) => {
  const schema = {
    type: 'object',
    properties: {
      taskConfig: {
        type: 'object',
        properties: {
          options: {
            type: 'object',
            properties: {
              inOrder: { type: 'boolean' },
              senderMsg: { type: 'string', maxLength: 1000 },
              notificantEmail: { type: 'string', format: 'email' },
              notificantLocale: { type: 'string', enum: ['en-US', 'zh-TW'] }
            },
            required: ['inOrder', 'senderMsg']
          },
          signerInfoList: signerInfoListSchema
        },
        required: ['options', 'signerInfoList']
      },
      fieldList: {
        type: 'array',
        items: fieldSchema,
        minItems: 1
      },
      pdfFileName: { type: 'string', minLength: 1, maxLength: 100 },
      isPreview: { type: 'boolean' }
    },
    required: ['taskConfig', 'fieldList', 'pdfFileName']
  };
  const params = { taskConfig, fieldList, pdfFileName, isPreview };
  return new Validator().validate(params, schema);
};

export const checkSendWithTemplateAPIParams = (taskConfig: any, isPreview: any) => {
  const schema = {
    type: 'object',
    properties: {
      taskConfig: {
        type: 'object',
        properties: {
          options: {
            type: 'object',
            properties: {
              inOrder: { type: 'boolean' },
              senderMsg: { type: 'string', maxLength: 1000 },
              notificantEmail: { type: 'string', format: 'email' },
              notificantLocale: { type: 'string', enum: ['en-US', 'zh-TW'] }
            },
            required: ['inOrder', 'senderMsg']
          },
          signerInfoList: signerInfoListSchema
        },
        required: ['options', 'signerInfoList']
      },
      isPreview: { type: 'boolean' }
    },
    required: ['taskConfig']
  };
  const params = { taskConfig, isPreview };
  return new Validator().validate(params, schema);
};

export const checkBulkSendAPIParams = (
  taskConfig: any,
  fieldList: any,
  pdfFileName: any,
  isPreview: any,
  signerNo: any
) => {
  const schema = {
    type: 'object',
    properties: {
      taskConfig: {
        type: 'object',
        properties: {
          options: {
            type: 'object',
            properties: {
              senderMsg: { type: 'string', maxLength: 1000 },
              notificantEmail: { type: 'string', format: 'email' },
              notificantLocale: { type: 'string', enum: ['en-US', 'zh-TW'] }
            },
            required: ['senderMsg']
          },
          signerInfoList: signerInfoListSchema
        },
        required: ['options', 'signerInfoList']
      },
      fieldList: {
        type: 'array',
        items: bulkFieldSchema,
        minItems: 1
      },
      pdfFileName: { type: 'string', minLength: 1, maxLength: 100 },
      isPreview: { type: 'boolean' },
      signerNo: { type: 'number', minimum: 0 }
    },
    required: ['taskConfig', 'fieldList', 'pdfFileName']
  };
  const params = { taskConfig, fieldList, pdfFileName, isPreview, signerNo };
  return new Validator().validate(params, schema);
};

export const checkBulkSendWithTemplateAPIParams = (taskConfig: any, isPreview: any, signerNo: any) => {
  const schema = {
    type: 'object',
    properties: {
      taskConfig: {
        type: 'object',
        properties: {
          options: {
            type: 'object',
            properties: {
              senderMsg: { type: 'string', maxLength: 1000 },
              notificantEmail: { type: 'string', format: 'email' },
              notificantLocale: { type: 'string', enum: ['en-US', 'zh-TW'] }
            },
            required: ['senderMsg']
          },
          signerInfoList: signerInfoListSchema
        },
        required: ['options', 'signerInfoList']
      },
      isPreview: { type: 'boolean' },
      signerNo: { type: 'number', minimum: 0 }
    },
    required: ['taskConfig']
  };
  const params = { taskConfig, isPreview, signerNo };
  return new Validator().validate(params, schema);
};

export const checkCreateSendTemplateAPIParams = (fieldList: any, pdfFileName: any) => {
  const schema = {
    type: 'object',
    properties: {
      fieldList: {
        type: 'array',
        items: fieldSchema,
        minItems: 1
      },
      pdfFileName: { type: 'string', minLength: 1, maxLength: 100 }
    },
    required: ['fieldList', 'pdfFileName']
  };
  const params = { fieldList, pdfFileName };
  return new Validator().validate(params, schema);
};

export const checkCreateBulkSendTemplateAPIParams = (fieldList: any, pdfFileName: any) => {
  const schema = {
    type: 'object',
    properties: {
      fieldList: {
        type: 'array',
        items: bulkFieldSchema,
        minItems: 1
      },
      pdfFileName: { type: 'string', minLength: 1, maxLength: 100 }
    },
    required: ['fieldList', 'pdfFileName']
  };
  const params = { fieldList, pdfFileName };
  return new Validator().validate(params, schema);
};

export const checkGetStatusAPIParams = (taskID: string) => {
  const schema = {
    type: 'object',
    properties: {
      taskID: { type: 'string', minLength: 20 }
    },
    required: ['taskID']
  };
  const params = { taskID };
  return new Validator().validate(params, schema);
};

export const checkGetResultAPIParams = (taskID: string, imapConfig: any, taskPassword: string) => {
  const schema = {
    type: 'object',
    properties: {
      taskID: { type: 'string', minLength: 20 },
      imapConfig: {
        type: 'object',
        properties: {
          user: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 1 },
          host: { type: 'string', minLength: 1 },
          port: { type: 'number' }
        },
        required: ['user', 'password', 'host', 'port']
      },
      taskPassword: { type: 'string' }
    },
    required: ['taskID', 'imapConfig', 'taskPassword']
  };
  const params = { taskID, imapConfig, taskPassword };
  return new Validator().validate(params, schema);
};

export const checkParsedTemplate = (parsedTemplate: any) => {
  const schema = {
    type: 'object',
    properties: {
      pdfFileName: { type: 'string', minLength: 1, maxLength: 100 },
      templateInfo: {
        type: 'object',
        properties: {
          version: { type: 'string', enum: ['1.1'] },
          signerList: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                fieldList: {
                  type: 'array',
                  minItems: 1,
                  items: {
                    type: 'object',
                    properties: {
                      x: { type: 'number', minimum: 0 },
                      y: { type: 'number', minimum: 0 },
                      height: { type: 'number', minimum: 12, maximum: 64 },
                      pageNo: { type: 'number', minimum: 1 },
                      type: { type: 'number', enum: [0, 1, 2, 3, 4] }
                    },
                    required: ['x', 'y', 'height', 'pageNo', 'type']
                  }
                }
              },
              required: ['fieldList']
            }
          }
        },
        required: ['version', 'signerList']
      }
    },
    required: ['pdfFileName', 'templateInfo']
  };
  return new Validator().validate(parsedTemplate, schema);
};

export const checkPdfFileData = (pdfFileDataBuffer: any) => {
  // check if password proected or secured
  try {
    const tmpPdfMgr = new corePdfManager.LocalPdfManager('dummy', toArrayBuffer(pdfFileDataBuffer), '', {}, '');
    tmpPdfMgr.pdfDocument.parseStartXRef();
    try {
      tmpPdfMgr.pdfDocument.parse();
    } catch (parseErr: any) {
      if (parseErr.code && parseErr.code === 1) {
        return { retCode: checkerErrorCode.PWD_PROTECTED_PDF };
      }
      return { retCode: checkerErrorCode.INVALID_TEMPLATE_DATA };
    }

    const { xref } = tmpPdfMgr.pdfDocument;
    if (xref.encrypt !== undefined && xref.encrypt !== null) {
      return { retCode: checkerErrorCode.SECURED_PDF };
    }
  } catch (err) {
    console.error(err);
    return { retCode: checkerErrorCode.INVALID_TEMPLATE_DATA };
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

    if (isSigned) return { retCode: checkerErrorCode.SIGNED_PDF };
  } catch (err) {
    console.error(err);
    return { retCode: checkerErrorCode.INVALID_TEMPLATE_DATA };
  }

  return { retCode: checkerErrorCode.SUCCESS };
};

export const checkSignerPhoneNum = (signerInfoList: any) => {
  for (let signerIndex = 0; signerIndex !== signerInfoList.length; signerIndex += 1) {
    const { phoneNumber } = signerInfoList[signerIndex];
    if (phoneNumber && phoneNumber.length > 0) {
      if (!isValidPhoneNumber(phoneNumber)) {
        return {
          retCode: checkerErrorCode.PHONE_NUMBER_CHECK_FAIL,
          errorAtIndex: signerIndex
        };
      }
    }
  }

  return { retCode: checkerErrorCode.SUCCESS };
};

export const checkWithLimitConfig = (
  limitConfig: any,
  signerInfoList: any,
  signerFieldList: any,
  pdfFileDataBuffer: any,
  isBulk: any
) => {
  const { maxSignerNumber, maxFieldPerType, maxFileSizeInMb, maxBulkSendSignerNumber } = limitConfig;

  if (isBulk) {
    if (signerInfoList.length > maxBulkSendSignerNumber)
      return { retCode: checkerErrorCode.MEET_SIGNER_LIMIT, limitVal: maxBulkSendSignerNumber };
  } else {
    // eslint-disable-next-line no-lonely-if
    if (signerInfoList.length > maxSignerNumber)
      return { retCode: checkerErrorCode.MEET_SIGNER_LIMIT, limitVal: maxSignerNumber };
  }

  for (let signerIndex = 0; signerIndex < signerFieldList.length; signerIndex += 1) {
    const signerField = signerFieldList[signerIndex];
    const fieldGroup: { [key: string]: any } = {};

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
          retCode: checkerErrorCode.MEET_FIELD_LIMIT,
          limitVal: maxFieldPerType,
          errorAtIndex: signerIndex
        };
      }
    }
  }

  if (pdfFileDataBuffer.length > maxFileSizeInMb * 1024 * 1024)
    return { retCode: checkerErrorCode.MEET_PDF_SIZE_LIMIT, limitVal: maxFileSizeInMb };

  return { retCode: checkerErrorCode.SUCCESS };
};
