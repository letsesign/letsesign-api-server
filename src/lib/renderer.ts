const fs = require('fs');
const path = require('path');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const FIELD_TYPE = {
  NAME: 2,
  EMAIL: 3,
  PHONE: 4
};

const FONT_TYPE = {
  TimesRoman: 'times',
  KAIU: 'kaiu'
};

const FONT_FACTOR = {
  TimesRoman: 1.2,
  KAIU: 0.9
};

const checkPDFBoundary = (pageWidth: number, pageHeight: number, xPos: number, yPos: number, height: number) => {
  if (xPos < 0 || xPos > pageWidth) throw new Error('x coordinate of field is out of range');

  if (yPos < 0 || yPos > pageHeight) throw new Error('y coordinate of field is out of range');

  if (yPos + height > pageHeight) throw new Error('height of field is out of range');
};

const drawTextField = (
  pageObj: any,
  fontObj: any,
  fontAdjustmentFactor: any,
  pageHeight: number,
  xPos: number,
  yPos: number,
  height: number,
  text: any
) => {
  const textFontSize = height;

  pageObj.drawText(text, {
    x: xPos,
    y: pageHeight - (yPos + height),
    size: textFontSize,
    font: fontObj,
    color: rgb(0, 0, 0)
  });
};

export const renderPDF = async (taskConfig: any, templateInfo: any, templateData: any) => {
  const pdfDoc = await PDFDocument.load(templateData.toString('base64'));
  const pages = pdfDoc.getPages();
  const fieldListByPage: { [key: string]: any } = {}; // .ts fix
  const fontCache: { [key: string]: any } = {}; // .ts fix
  const getFontObjFn = async (fontType: any) => {
    switch (fontType) {
      case FONT_TYPE.TimesRoman:
        if (!(FONT_TYPE.TimesRoman in fontCache))
          fontCache[FONT_TYPE.TimesRoman] = await pdfDoc.embedFont(StandardFonts.TimesRoman);

        return fontCache[FONT_TYPE.TimesRoman];
      case FONT_TYPE.KAIU:
        if (!(FONT_TYPE.KAIU in fontCache))
          fontCache[FONT_TYPE.KAIU] = await pdfDoc.embedFont(
            fs.readFileSync(path.resolve(__dirname, '..', '..', 'resources', 'fonts', 'kaiu.ttf')).toString('base64'),
            { subset: true }
          );

        return fontCache[FONT_TYPE.KAIU];
      default:
        throw new Error('invalid font type');
    }
  };

  pdfDoc.registerFontkit(fontkit);

  // group fields by pageNo
  for (let signerIndex = 0; signerIndex < templateInfo.signerList.length; signerIndex += 1) {
    const signer = templateInfo.signerList[signerIndex];

    for (let fieldIndex = 0; fieldIndex < signer.fieldList.length; fieldIndex += 1) {
      const field = signer.fieldList[fieldIndex];

      if (field.pageNo < 1 || field.pageNo > pages.length) throw new Error('pageNo of field is out of range');

      if (!(`${field.pageNo}` in fieldListByPage)) fieldListByPage[`${field.pageNo}`] = [];

      if (taskConfig.signerInfoList[signerIndex]) {
        fieldListByPage[`${field.pageNo}`].push({
          name: taskConfig.signerInfoList[signerIndex].name,
          emailAddr: taskConfig.signerInfoList[signerIndex].emailAddr,
          ...(taskConfig.signerInfoList[signerIndex].phoneNumber && {
            phoneNumber: taskConfig.signerInfoList[signerIndex].phoneNumber
          }),
          ...field
        });
      } else throw new Error('invalid signer index');
    }
  }

  // iterate fields by pageNo
  const fieldListByPageKeys = Object.keys(fieldListByPage);

  for (let pageNoIndex = 0; pageNoIndex < fieldListByPageKeys.length; pageNoIndex += 1) {
    const pageNo = fieldListByPageKeys[pageNoIndex];
    const pageObj = pages[parseInt(pageNo, 10) - 1];
    const { width, height } = pageObj.getSize();

    for (let fieldIndex = 0; fieldIndex < fieldListByPage[pageNo].length; fieldIndex += 1) {
      const field = fieldListByPage[pageNo][fieldIndex];

      checkPDFBoundary(width, height, field.x, field.y, field.height);

      if (field.type === FIELD_TYPE.NAME) {
        const timesFont = await getFontObjFn(FONT_TYPE.TimesRoman); // .ts fix
        let passTimesCheck = true;
        const nameCharacterSet = [...field.name];

        for (let charIndex = 0; charIndex < nameCharacterSet.length; charIndex += 1) {
          const char = nameCharacterSet[charIndex];

          if (!timesFont.getCharacterSet().includes(char.codePointAt(0))) {
            passTimesCheck = false;
            break;
          }
        }

        if (passTimesCheck) {
          drawTextField(
            pageObj,
            await getFontObjFn(FONT_TYPE.TimesRoman), // .ts fix
            FONT_FACTOR.TimesRoman,
            height,
            field.x,
            field.y,
            field.height,
            field.name
          );
        } else
          drawTextField(
            pageObj,
            await getFontObjFn(FONT_TYPE.KAIU), // .ts fix
            FONT_FACTOR.KAIU,
            height,
            field.x,
            field.y,
            field.height,
            field.name
          );
      } else if (field.type === FIELD_TYPE.EMAIL) {
        drawTextField(
          pageObj,
          await getFontObjFn(FONT_TYPE.TimesRoman), // .ts fix
          FONT_FACTOR.TimesRoman,
          height,
          field.x,
          field.y,
          field.height,
          field.emailAddr
        );
      } else if (field.type === FIELD_TYPE.PHONE) {
        if (field.phoneNumber) {
          drawTextField(
            pageObj,
            await getFontObjFn(FONT_TYPE.TimesRoman), // .ts fix
            FONT_FACTOR.TimesRoman,
            height,
            field.x,
            field.y,
            field.height,
            field.phoneNumber
          );
        }
      }
    }
  }

  return Buffer.from(await pdfDoc.save());
};
