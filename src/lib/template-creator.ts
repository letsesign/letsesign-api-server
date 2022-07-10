import {
  checkCreateSendTemplateAPIParams,
  checkCreateBulkSendTemplateAPIParams,
  checkPdfFileData,
  checkerErrorCode
} from './params-checker';

const JSZip = require('jszip');
// const { Caller } = require('./caller');

const createTemplate = async (templateInfo: any, pdfFileName: any, pdfFileDataBuffer: any) => {
  const zip = new JSZip();

  zip.file('template.json', JSON.stringify({ pdfFileName, templateInfo }));
  zip.file('template.pdf', pdfFileDataBuffer);

  const zipB64 = await zip.generateAsync({ type: 'base64' });

  return zipB64;
};

export const parseTemplate = async (template: any) => {
  const zip = new JSZip();
  let unzipResult = null;

  try {
    unzipResult = await zip.loadAsync(Buffer.from(template, 'base64'));
  } catch (err) {
    console.error(err);
    throw new Error('Invalid parameter: invalid template format');
  }

  if (!('template.json' in unzipResult.files)) throw new Error('Invalid parameter: missing template.json in template');
  if (!('template.pdf' in unzipResult.files)) throw new Error('Invalid parameter: missing template.pdf in template');

  try {
    const { pdfFileName, templateInfo } = JSON.parse(await unzipResult.files['template.json'].async('text'));
    const pdfFileDataBuffer = await unzipResult.files['template.pdf'].async('nodebuffer');

    return {
      pdfFileName,
      templateInfo,
      pdfFileDataBuffer
    };
  } catch (err) {
    throw new Error('Invalid parameter: invalid template format');
  }
};

export const createSendTemplate = async (fieldList: any, pdfFileName: any, pdfFileData: any) => {
  const resp = {
    httpCode: 500,
    errorMsg: 'Undefined error',
    response: {}
  };

  try {
    // check parameters with schema
    const checkParamsResult = checkCreateSendTemplateAPIParams(fieldList, pdfFileName);
    if (!checkParamsResult.valid) {
      resp.httpCode = 400;
      resp.errorMsg =
        // eslint-disable-next-line no-useless-concat
        `Invalid parameter: ${checkParamsResult.errors[0].path.join('.')} ` + `${checkParamsResult.errors[0].message}`;
      return resp;
    }

    // check PDF
    const pdfFileDataBuffer = Buffer.from(pdfFileData, 'base64');
    const checkTemplateDataResult = checkPdfFileData(pdfFileDataBuffer);
    if (checkTemplateDataResult.retCode !== checkerErrorCode.SUCCESS) {
      resp.httpCode = 400;

      if (checkTemplateDataResult.retCode === checkerErrorCode.INVALID_TEMPLATE_DATA)
        resp.errorMsg = 'Invalid parameter: pdfFileData is not a valid PDF';
      else if (checkTemplateDataResult.retCode === checkerErrorCode.PWD_PROTECTED_PDF)
        resp.errorMsg = 'Invalid parameter: pdfFileData is a password protected PDF';
      else if (checkTemplateDataResult.retCode === checkerErrorCode.SECURED_PDF)
        resp.errorMsg = 'Invalid parameter: pdfFileData is a secured PDF';
      else if (checkTemplateDataResult.retCode === checkerErrorCode.SIGNED_PDF)
        resp.errorMsg = 'Invalid parameter: pdfFileData is a signed PDF';
      else console.error(checkTemplateDataResult);

      return resp;
    }

    // check fieldList
    let maxSignerNo = 0;
    const signerGroup: { [key: string]: any } = {}; // .ts fix
    for (let fieldIndex = 0; fieldIndex !== fieldList.length; fieldIndex += 1) {
      const fieldData = fieldList[fieldIndex];

      if (fieldData.signerNo > maxSignerNo) maxSignerNo = fieldData.signerNo;

      if (!(fieldData.signerNo.toString() in signerGroup)) signerGroup[fieldData.signerNo.toString()] = [];

      signerGroup[fieldData.signerNo.toString()].push({
        pageNo: fieldData.fieldInfo.pageNo,
        x: fieldData.fieldInfo.x,
        y: fieldData.fieldInfo.y,
        height: fieldData.fieldInfo.height,
        type: fieldData.fieldInfo.type
      });
    }

    const internalTemplateInfo = {
      version: '1.1',
      signerList: new Array(maxSignerNo + 1).fill({}).map(() => ({ fieldList: [] })) // .ts fix
    };
    for (let signerIndex = 0; signerIndex <= maxSignerNo; signerIndex += 1) {
      if (!(signerIndex.toString() in signerGroup)) {
        resp.httpCode = 400;
        resp.errorMsg = `Invalid parameter: missing the No. ${signerIndex} signer's fieldInfo`;
        return resp;
      }

      let sigFieldExist = false;
      const signerFieldList = signerGroup[signerIndex.toString()];

      for (let fieldIndex = 0; fieldIndex !== signerFieldList.length; fieldIndex += 1) {
        if (signerFieldList[fieldIndex].type === 0) {
          sigFieldExist = true;
          break;
        }
      }

      if (sigFieldExist) internalTemplateInfo.signerList[signerIndex].fieldList = signerFieldList;
      else {
        resp.httpCode = 400;
        resp.errorMsg = `Invalid parameter: the No. ${signerIndex} signer requires at least one signature field`;
        return resp;
      }
    }

    const zipB64 = await createTemplate(internalTemplateInfo, pdfFileName, pdfFileDataBuffer);

    resp.httpCode = 200;
    resp.response = { template: zipB64 };
  } catch (err) {
    console.error(err);
    resp.httpCode = 500;
    resp.errorMsg = 'Internal error';
  }

  return resp;
};

export const createBulkSendTemplate = async (fieldList: any, pdfFileName: any, pdfFileData: any) => {
  const resp = {
    httpCode: 500,
    errorMsg: 'Undefined error',
    response: {}
  };

  try {
    // check parameters with schema
    const checkParamsResult = checkCreateBulkSendTemplateAPIParams(fieldList, pdfFileName);
    if (!checkParamsResult.valid) {
      resp.httpCode = 400;
      resp.errorMsg =
        // eslint-disable-next-line no-useless-concat
        `Invalid parameter: ${checkParamsResult.errors[0].path.join('.')} ` + `${checkParamsResult.errors[0].message}`;
      return resp;
    }

    // check PDF
    const pdfFileDataBuffer = Buffer.from(pdfFileData, 'base64');
    const checkTemplateDataResult = checkPdfFileData(pdfFileDataBuffer);
    if (checkTemplateDataResult.retCode !== checkerErrorCode.SUCCESS) {
      resp.httpCode = 400;

      if (checkTemplateDataResult.retCode === checkerErrorCode.INVALID_TEMPLATE_DATA)
        resp.errorMsg = 'Invalid parameter: pdfFileData is not a valid PDF';
      else if (checkTemplateDataResult.retCode === checkerErrorCode.PWD_PROTECTED_PDF)
        resp.errorMsg = 'Invalid parameter: pdfFileData is a password protected PDF';
      else if (checkTemplateDataResult.retCode === checkerErrorCode.SECURED_PDF)
        resp.errorMsg = 'Invalid parameter: pdfFileData is a secured PDF';
      else if (checkTemplateDataResult.retCode === checkerErrorCode.SIGNED_PDF)
        resp.errorMsg = 'Invalid parameter: pdfFileData is a signed PDF';
      else console.error(checkTemplateDataResult);

      return resp;
    }

    // - check fieldList
    let sigFieldExist = false;
    const ary: object[] = [];
    const internalTemplateInfo = {
      version: '1.1',
      signerList: [{ fieldList: ary }] // .ts fix
    };
    for (let fieldIndex = 0; fieldIndex !== fieldList.length; fieldIndex += 1) {
      const fieldData = fieldList[fieldIndex];

      if (fieldData.fieldInfo.type === 0) sigFieldExist = true;

      internalTemplateInfo.signerList[0].fieldList.push({
        pageNo: fieldData.fieldInfo.pageNo,
        x: fieldData.fieldInfo.x,
        y: fieldData.fieldInfo.y,
        height: fieldData.fieldInfo.height,
        type: fieldData.fieldInfo.type
      });
    }
    if (!sigFieldExist) {
      resp.httpCode = 400;
      resp.errorMsg = `Invalid parameter: bulk signers require at least one signature field`;
      return resp;
    }

    const zipB64 = await createTemplate(internalTemplateInfo, pdfFileName, pdfFileDataBuffer);

    resp.httpCode = 200;
    resp.response = { template: zipB64 };
  } catch (err) {
    console.error(err);
    resp.httpCode = 500;
    resp.errorMsg = 'Internal error';
  }

  return resp;
};
