/* eslint-disable no-console */
const { resolve } = require('path');
const { inspect } = require('util');
const { readFileSync } = require('fs');
const axios = require('axios');

const proc = async (cmdArgs) => {
  const pdfBufferB64 = readFileSync(resolve(__dirname, cmdArgs[0])).toString('base64');
  const spfDataB64 = readFileSync(resolve(__dirname, cmdArgs[1])).toString('base64');

  const result = await axios.post('http://localhost/verify-pdf', {
    pdfBufferB64,
    spfDataB64
  });

  return result.data;
};

const cmdArgs = process.argv.slice(2);
if (cmdArgs.length > 1) {
  proc(cmdArgs)
    .then((result) => {
      console.log(inspect(result, { depth: null }));
    })
    .catch((error) => {
      console.error(error);
    });
} else {
  console.log('Usage: node verify-result.js PDF_DOCUMENT SIGNING_PROOF');
}
