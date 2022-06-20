#!/bin/bash

curl -sO https://raw.githubusercontent.com/letsesign/letsesign-enclave/main/tcb-info.json

mkdir -p /root/.letsesign
echo "{\"awsAccessKeyID\":\"$awsAccessKeyID\",\"awsSecretAccessKey\":\"$awsSecretAccessKey\"}" > /root/.letsesign/siteSetting.json
node ./scripts/kms-update.js
node ./scripts/kms-download.js
unset awsAccessKeyID
unset awsSecretAccessKey
rm -rf /root/.letsesign

pm2-runtime index.js
