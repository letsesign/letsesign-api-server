/* eslint-disable global-require */
const _ = require('lodash');
const cbor = require('cbor');
const pkijs = require('pkijs');
const asn1js = require('asn1js');
const Base64 = require('js-base64');

const crypto = require('crypto').webcrypto;
// eslint-disable-next-line import/no-unresolved
const tcbInfo = require('../tcb-info.json');

const gAwsRootCert = `-----BEGIN CERTIFICATE-----
MIICETCCAZagAwIBAgIRAPkxdWgbkK/hHUbMtOTn+FYwCgYIKoZIzj0EAwMwSTEL
MAkGA1UEBhMCVVMxDzANBgNVBAoMBkFtYXpvbjEMMAoGA1UECwwDQVdTMRswGQYD
VQQDDBJhd3Mubml0cm8tZW5jbGF2ZXMwHhcNMTkxMDI4MTMyODA1WhcNNDkxMDI4
MTQyODA1WjBJMQswCQYDVQQGEwJVUzEPMA0GA1UECgwGQW1hem9uMQwwCgYDVQQL
DANBV1MxGzAZBgNVBAMMEmF3cy5uaXRyby1lbmNsYXZlczB2MBAGByqGSM49AgEG
BSuBBAAiA2IABPwCVOumCMHzaHDimtqQvkY4MpJzbolL//Zy2YlES1BR5TSksfbb
48C8WBoyt7F2Bw7eEtaaP+ohG2bnUs990d0JX28TcPQXCEPZ3BABIeTPYwEoCWZE
h8l5YoQwTcU/9KNCMEAwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUkCW1DdkF
R+eWw5b6cp3PmanfS5YwDgYDVR0PAQH/BAQDAgGGMAoGCCqGSM49BAMDA2kAMGYC
MQCjfy+Rocm9Xue4YnwWmNJVA44fA0P5W2OpYow9OYCVRaEevL8uO1XYru5xtMPW
rfMCMQCi85sWBbJwKKXdS6BptQFuZbT73o/gBh1qUxl/nNr12UO8Yfwr6wPLb+6N
IwLz3/Y=
-----END CERTIFICATE-----`;

const toArrayBuffer = (nodeBuffer: Buffer) => {
  return nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength);
};

const typedArrayToBuffer = (array: any) => {
  return array.buffer.slice(array.byteOffset, array.byteLength + array.byteOffset);
};

const sha256Hex = async (data: any) => {
  if (typeof data === 'string') {
    return Buffer.from(await crypto.subtle.digest('SHA-256', toArrayBuffer(Buffer.from(data)))).toString('hex');
  }

  return Buffer.from(await crypto.subtle.digest('SHA-256', toArrayBuffer(data))).toString('hex');
};

const verifyAtDoc = async (adocB64: any) => {
  pkijs.setEngine(
    'newEngine',
    crypto,
    new pkijs.CryptoEngine({
      name: '',
      crypto,
      subtle: crypto.subtle
    })
  );
  const atDocData = Buffer.from(adocB64, 'base64');
  const result = { pcr0: '', pcr1: '', pcr2: '', userData: '' };
  const decodedAttestDoc = cbor.decodeFirstSync(toArrayBuffer(atDocData));
  const contentDoc = cbor.decodeFirstSync(decodedAttestDoc[2]);
  // eslint-disable-next-line no-restricted-syntax
  for (const [key, value] of contentDoc.pcrs) {
    if (key === 0) {
      result.pcr0 = Buffer.from(value).toString('hex');
    } else if (key === 1) {
      result.pcr1 = Buffer.from(value).toString('hex');
    } else if (key === 2) {
      result.pcr2 = Buffer.from(value).toString('hex');
    }
  }
  result.userData = JSON.parse(Buffer.from(contentDoc.user_data).toString());
  // ################################
  //  # 3.2.2 Syntactical validation - Check if the required fields are present and check content
  //  ################################
  // # module_id - Module ID must be non-empty
  if (contentDoc.module_id === null || contentDoc.module_id === undefined) {
    throw new Error('invalid module_id');
  }
  // # digest -  Digest can be exactly one of these values, $value ∈ {"SHA384"}
  if (contentDoc.digest === null || contentDoc.digest === undefined || contentDoc.digest !== 'SHA384') {
    throw new Error('invalid digest');
  }
  // # timestamp - Timestamp must be greater than 0
  if (contentDoc.timestamp === null || contentDoc.timestamp === undefined || contentDoc.timestamp < 0) {
    throw new Error('invalid timestamp');
  }
  // # pcrs - verify with input pcrs
  if (contentDoc.pcrs === null || contentDoc.pcrs === undefined || contentDoc.pcrs.size === 0) {
    throw new Error('invalid pcrs');
  }
  // # cabundle - CA Bundle is not allowed to have 0 elements
  if (contentDoc.cabundle === null || contentDoc.cabundle === undefined || contentDoc.cabundle.length === 0) {
    throw new Error('invalid cabundle');
  }
  // user_data
  if (contentDoc.user_data === null || contentDoc.user_data === undefined) {
    throw new Error('invalid user_data');
  }
  // ################################
  // # 3.2.3 Semantical validation - Certificates validity, Certificates critical extensions
  // ################################
  const signCert = new pkijs.Certificate({
    schema: asn1js.fromBER(typedArrayToBuffer(contentDoc.certificate)).result
  });
  // # Certificates critical extensions: basic constraints
  // # Certificates critical extensions: key usage
  let hasBasicConstraints = false;
  let hasKeyUsage = false;
  for (let idx = 0; idx !== signCert.extensions.length; idx += 1) {
    if (signCert.extensions[idx].extnID === '2.5.29.19') {
      // BasicConstraints
      hasBasicConstraints = true;
    }
    if (signCert.extensions[idx].extnID === '2.5.29.15') {
      // KeyUsage
      hasKeyUsage = true;
    }
  }
  if (!hasBasicConstraints || !hasKeyUsage) {
    throw new Error('invalid certificate extension');
  }
  // ################################
  //  # 3.2.4 Certificates chain
  // ################################
  // load root certificate
  const rootCertDer = Buffer.from(gAwsRootCert.replace(/(-----(BEGIN|END) CERTIFICATE-----|[\n\r])/g, ''), 'base64');
  const rootAwsRootCert = new pkijs.Certificate({
    schema: asn1js.fromBER(toArrayBuffer(rootCertDer)).result
  });
  // load certs from cabundle
  const certificates = [];
  for (let idx = 0; idx !== contentDoc.cabundle.length; idx += 1) {
    const cert = new pkijs.Certificate({
      schema: asn1js.fromBER(typedArrayToBuffer(contentDoc.cabundle[idx])).result
    });
    certificates.push(cert);
  }
  certificates.push(signCert);
  const certChainVerificationEngine = new pkijs.CertificateChainValidationEngine({
    trustedCerts: [rootAwsRootCert],
    certs: certificates,
    checkDate: new Date(contentDoc.timestamp)
  });
  const certVerifyResult = await certChainVerificationEngine.verify();
  if (certVerifyResult.result === false) {
    throw new Error('certificate chain verified error');
  }

  const keyResult = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-384',
      x: Base64.encode(signCert.subjectPublicKeyInfo.parsedKey.x, true),
      y: Base64.encode(signCert.subjectPublicKeyInfo.parsedKey.y, true),
      ext: true
    },
    {
      name: 'ECDSA',
      namedCurve: 'P-384'
    },
    false,
    ['verify']
  );
  const encodedResult = cbor.encode(['Signature1', decodedAttestDoc[0], new ArrayBuffer(0), decodedAttestDoc[2]]);
  const verifyResult = await crypto.subtle.verify(
    {
      name: 'ECDSA',
      hash: {
        name: 'SHA-384'
      }
    },
    keyResult,
    decodedAttestDoc[3],
    encodedResult
  );
  if (verifyResult === false) {
    throw new Error('attentation document signature error');
  }
  return result;
};

const parsePdfDoc = async (pdfB64: any) => {
  const pdfBuffer = Buffer.from(pdfB64, 'base64');
  const result = { pdfHashHex: '' };
  try {
    const pdfHashHex = await sha256Hex(pdfBuffer);
    result.pdfHashHex = pdfHashHex;
    return result;
  } catch (err) {
    return result;
  }
};

const compareBindingDataHash = async (spfInfo: any, bindingDataHash: any) => {
  if (!('bindingDataHash' in spfInfo.summary)) throw new Error('missing bindingDataHash in summary');

  if (spfInfo.summary.bindingDataHash !== bindingDataHash) throw new Error('invalid bindingDataHash');
};

const comparePdfAndAtDocProc = (atDocInfo: any, pdfInfo: any, spfInfo: any) => {
  if (atDocInfo.userData.fnName === 'attachEsig') {
    // (1) check pdfHash
    let isValidPdfHash = false;
    let isValidSummaryHash = false;
    _.forEach(atDocInfo.userData.hashList, (hashItem: any) => {
      if (hashItem.name === 'esigPDF') {
        if (pdfInfo.pdfHashHex === hashItem.hash) {
          isValidPdfHash = true;
        }
      }
      if (hashItem.name === 'summary') {
        if (spfInfo.summaryHash === hashItem.hash) {
          isValidSummaryHash = true;
        }
      }
    });
    if (!isValidPdfHash || !isValidSummaryHash) {
      return null;
    }
    let enclaveVersion = 'UNKNOWN';
    let enclaveCodeURL = 'UNKNOWN';
    _.forEach(tcbInfo.versionList, (version: any) => {
      if (
        atDocInfo.pcr0 === version.pcrs['0'] &&
        atDocInfo.pcr1 === version.pcrs['1'] &&
        atDocInfo.pcr2 === version.pcrs['2']
      ) {
        enclaveVersion = version.verName;
        enclaveCodeURL = `https://github.com/letsesign/letsesign-enclave/releases/tag/${enclaveVersion}`;
        return false;
      }

      return true;
    });
    if (enclaveVersion === 'UNKNOWN') {
      return null;
    }
    return {
      enclaveVersion,
      enclaveCodeURL,
      summary: spfInfo.summary
    };
  }
  return null;
};

const parseSPF = async (spfB64: any) => {
  const result = { summary: '', summaryHash: '', adocB64: '' };
  try {
    const spf = JSON.parse(Buffer.from(spfB64, 'base64').toString());
    const summaryHash = await sha256Hex(JSON.stringify(spf.summary));

    result.summary = spf.summary;
    result.summaryHash = summaryHash;
    result.adocB64 = spf.attestDoc;
    return result;
  } catch (err) {
    return result;
  }
};

export const semiVerify = async (pdfB64: any, spfB64: any) => {
  try {
    const spfInfo = await parseSPF(spfB64);
    const atDocInfo = await verifyAtDoc(spfInfo.adocB64);
    const pdfInfo = await parsePdfDoc(pdfB64);
    const result = comparePdfAndAtDocProc(atDocInfo, pdfInfo, spfInfo);
    if (!result) {
      throw new Error('Invalid eSignature or Invalid Attestation Document');
    }
    return result;
  } catch (error) {
    return {
      error: String(error),
      enclaveVersion: '',
      enclaveCodeURL: '',
      summary: null
    };
  }
};

export const autoVerify = async (bindingDataHash: any, pdfB64: any, spfB64: any) => {
  try {
    const spfInfo = await parseSPF(spfB64);
    const atDocInfo = await verifyAtDoc(spfInfo.adocB64);
    const pdfInfo = await parsePdfDoc(pdfB64);
    await compareBindingDataHash(spfInfo, bindingDataHash);
    const result = comparePdfAndAtDocProc(atDocInfo, pdfInfo, spfInfo);
    if (!result) {
      throw new Error('Invalid eSignature or Invalid Attestation Document');
    }
    return result;
  } catch (error) {
    return {
      error: String(error),
      enclaveVersion: '',
      enclaveCodeURL: '',
      summary: null
    };
  }
};
