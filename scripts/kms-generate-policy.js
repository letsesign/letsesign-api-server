const { Validator } = require('jsonschema');
// eslint-disable-next-line import/no-unresolved
const tcbInfo = require('../tcb-info.json');

const generateKMSPolicy = (arn) => {
  const validateRet = new Validator().validate(arn, { type: 'string', pattern: '^arn:aws:kms:us-east-1:' });
  const getMostRecentVersions = (versionList) => {
    if (versionList.length > 2) {
      const orderedVersionList = versionList.sort((a, b) => a.issueTime - b.issueTime);
      return [orderedVersionList[orderedVersionList.length - 2], orderedVersionList[orderedVersionList.length - 1]];
    }

    return versionList;
  };

  if (validateRet.valid) {
    const iamId = arn.split(':')[4];
    const output = {
      Id: 'letsesign-key-policy',
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'Enable IAM User Permissions',
          Effect: 'Allow',
          Principal: {
            AWS: `arn:aws:iam::${iamId}:root`
          },
          Action: 'kms:*',
          Resource: '*'
        }
      ]
    };

    const mostRecentVersions = getMostRecentVersions(tcbInfo.versionList);

    for (let versionIndex = 0; versionIndex < mostRecentVersions.length; versionIndex += 1) {
      const versionInfo = mostRecentVersions[versionIndex];

      output.Statement.push({
        Sid: 'Enable enclave data processing',
        Effect: 'Allow',
        Principal: {
          AWS: 'arn:aws:iam::500455354473:user/letsesign-bot'
        },
        Action: 'kms:Decrypt',
        Resource: '*',
        Condition: {
          StringEqualsIgnoreCase: {
            'kms:RecipientAttestation:PCR0': versionInfo.pcrs['0'],
            'kms:RecipientAttestation:PCR1': versionInfo.pcrs['1'],
            'kms:RecipientAttestation:PCR2': versionInfo.pcrs['2']
          }
        }
      });
    }

    return JSON.stringify(output, null, 2);
  }

  throw new Error('ERROR: invalid KMS key ARN format');
};

module.exports = {
  generateKMSPolicy
};
