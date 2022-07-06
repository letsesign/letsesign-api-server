const { Validator } = require('jsonschema');

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

const checkSendAPIParams = (taskConfig, fieldList, pdfFileName) => {
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
      pdfFileName: { type: 'string', minLength: 1, maxLength: 100 }
    },
    required: ['taskConfig', 'fieldList', 'pdfFileName']
  };
  const params = { taskConfig, fieldList, pdfFileName };
  return new Validator().validate(params, schema);
};

const checkBulkSendAPIParams = (taskConfig, fieldList, pdfFileName) => {
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
      pdfFileName: { type: 'string', minLength: 1, maxLength: 100 }
    },
    required: ['taskConfig', 'fieldList', 'pdfFileName']
  };
  const params = { taskConfig, fieldList, pdfFileName };
  return new Validator().validate(params, schema);
};

module.exports = {
  checkSendAPIParams,
  checkBulkSendAPIParams
};
