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

class Renderer {
  constructor() {
    this.renderPDF = async (taskConfig, templateInfo, templateData) => {
      const pdfDoc = await PDFDocument.load(templateData.toString('base64'));
      const pages = pdfDoc.getPages();
      const fieldListByPage = {};
      const fontCache = {};
      const getFontObjFn = async (fontType) => {
        switch (fontType) {
          case FONT_TYPE.TimesRoman:
            if (!(FONT_TYPE.TimesRoman in fontCache))
              fontCache[FONT_TYPE.TimesRoman] = await pdfDoc.embedFont(StandardFonts.TimesRoman);

            return fontCache[FONT_TYPE.TimesRoman];
          case FONT_TYPE.KAIU:
            if (!(FONT_TYPE.KAIU in fontCache))
              fontCache[FONT_TYPE.KAIU] = await pdfDoc.embedFont(
                fs.readFileSync(path.resolve(__dirname, 'fonts', 'kaiu.ttf')).toString('base64'),
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
          } else throw new Error('invalid length of signerInfoList');
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

          this.checkPDFBoundary(width, height, field.x, field.y, field.height);

          if (field.type === FIELD_TYPE.NAME) {
            const timesFont = await getFontObjFn(FONT_TYPE.TimesRoman, pdfDoc, fontCache);
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
              this.drawTextField(
                pageObj,
                await getFontObjFn(FONT_TYPE.TimesRoman, pdfDoc, fontCache),
                FONT_FACTOR.TimesRoman,
                height,
                field.x,
                field.y,
                field.height,
                field.name
              );
            } else
              this.drawTextField(
                pageObj,
                await getFontObjFn(FONT_TYPE.KAIU, pdfDoc, fontCache),
                FONT_FACTOR.KAIU,
                height,
                field.x,
                field.y,
                field.height,
                field.name
              );
          } else if (field.type === FIELD_TYPE.EMAIL) {
            this.drawTextField(
              pageObj,
              await getFontObjFn(FONT_TYPE.TimesRoman, pdfDoc, fontCache),
              FONT_FACTOR.TimesRoman,
              height,
              field.x,
              field.y,
              field.height,
              field.emailAddr
            );
          } else if (field.type === FIELD_TYPE.PHONE) {
            if (field.phoneNumber) {
              this.drawTextField(
                pageObj,
                await getFontObjFn(FONT_TYPE.TimesRoman, pdfDoc, fontCache),
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

    this.checkPDFBoundary = (pageWidth, pageHeight, xPos, yPos, height) => {
      if (xPos < 0 || xPos > pageWidth) throw new Error('x position of filed is out of range');

      if (yPos < 0 || yPos > pageHeight) throw new Error('y position of filed is out of range');

      if (yPos + height > pageHeight) throw new Error('height of filed is out of range');
    };

    this.drawTextField = (pageObj, fontObj, fontAdjustmentFactor, pageHeight, xPos, yPos, height, text) => {
      const textFontSize = height;

      pageObj.drawText(text, {
        x: xPos,
        y: pageHeight - (yPos + height),
        size: textFontSize,
        font: fontObj,
        color: rgb(0, 0, 0)
      });
    };
  }
}

module.exports = {
  Renderer
};
