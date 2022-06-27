# Let's eSign API Server Examples

To run the examples, first execute the following:

```
git clone https://github.com/letsesign/letsesign-api-server-examples.git
cd letsesign-api-server-examples
npm install
```

### 1. To submit a confidential eSigning task

Edit `task-data/submit-task.json`, then run the following in the `examples` folder:
    
```bash
node submit-task.js
```
You can also replace `task-data/templateInfo.json` and `task-data/templateData.bin`, which can be obtained using the **Make Templates** feature of [Let's eSign Sender](https://github.com/letsesign/letsesign-sender), by your own.

<details>
  <summary>Explanation of submit-task.json</summary>
  
```
{
    "taskConfig": {
        "options": {
            "inOrder": true,
            "senderMsg": "",
            "notificantEmail": "",
            "notificantLocale": "en-US"
        },
        "signerInfoList": [
            {
                "name": "",
                "emailAddr": "",
                "locale": "en-US",
                "phoneNumber": ""
            }
        ]
    }
}
```
- `inOrder`: the flag indicating if a multiple-signer task shall be executed in the one-by-one order
- `senderMsg`: the text message that the sender wants to pass to the signer(s)
- `notificantEmail`: the email address of the notificant (who can receive email notifications as well as the final result)
- `notificantLocale`: the language used in email notifications (currently only `en-US` and `zh-TW` are supported)
- `signerInfoList`: the info of each signer, with `phoneNumber` (in international phone number format) an optional field

</details>

### 2. To submit confidential eSigning tasks in bulk

Edit `task-data/submit-bulk-task.json` and `task-data/submit-bulk-task.csv`, then run the following in the `examples` folder:
    
```bash
node submit-bulk-task.js
```
The CSV file should be self-explanatory.

<details>
  <summary>Explanation of submit-bulk-task.json</summary>
  
```
{
    "bulkTaskConfig": {
        "senderMsg": "",
        "notificantEmail": "",
        "notificantLocale": "en-US"
    }
}
```
- `senderMsg`: the text message that the sender wants to pass to the signer(s)
- `notificantEmail`: the email address of the notificant (who can receive email notifications as well as the final result)
- `notificantLocale`: the language used in email notifications (currently only `en-US` and `zh-TW` are supported)

</details>


### 3. To verify a confidentially eSigned document

Here are 2 verification modes. In the **semi** mode, in addition to software verification, human eyes are needed to check if the eSigned document matches the original unsigned document. And in the **auto** mode, an additional `BINDING_DATA_HASH`, which is bound to the original unsigned document, needs to be supplied. The `BINDING_DATA_HASH` is computed by the SDK and is part of the returned info when submitting the corresponding task using the SDK.

```bash
node semi-verify-pdf.js PDF_DOCUMENT SIGNING_PROOF
```

```bash
node auto-verify-pdf.js PDF_DOCUMENT SIGNING_PROOF BINDING_DATA_HASH
```
The `SIGNING_PROOF` is the `.spf` file that accompanies every confidentially eSigned `PDF_DOCUMENT`.
