# Let's eSign API Server Examples

To run the examples, first execute the following:

```
git clone https://github.com/letsesign/letsesign-api-server-examples.git
cd letsesign-api-server-examples
npm install
```

### 1. To submit a confidential eSigning task

Edit `examples/task-data/submit-task.json` and then run the following:
    
```bash
node examples/submit-task.js
```

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

You can also replace `task-data/templateData.bin` and `task-data/templateInfo.json` by your own, where `templateData.bin` is just your PDF document with a canonical name and the structure of `templateInfo.json` is explained below.

<details>
  <summary>Explanation of templateInfo.json</summary>
  
```
{
  "version": "1.0",
  "fileName": "sample.pdf",
  "signerList": [
    {
      "fieldList": [
        {
          "x": 362,
          "y": 468,
          "height": 32,
          "pageNo": 2,
          "type": 0
        }
      ]
    }
  ]
}
```
- `fileName`: the file name of your PDF document
- `signerList`: each object in `signerList` represents a signer and can have multiple fields
- `fieldList`: each object in `fieldList` represents a field to be rendered on your PDF document
- `x` and `y`: the top-left corner of the field relative to the top-left corner of the PDF document
- `height`: the height of the field (you will find [GIMP](https://www.gimp.org/) helpful when setting  `x`, `y` and `height`)
- `pageNo`: the page where the field is located
- `type`:

   | type | meaning        |
   | ---- | -------------- |
   | 0    | signature      |
   | 1    | date signed    |
   | 2    | signer name    |
   | 3    | signer email   |
   | 4    | signer phone # |

</details>

Note the number and the order of signers in the `signerInfoList` field of `submit-task.json` must match the number and the order of signers in the `signerList` field of `templateInfo.json`.

### 2. To submit confidential eSigning tasks in bulk

Edit `examples/task-data/submit-bulk-task.json`, which is identical to the above `submit-task.json` except the missing `inOrder` field, and then run the following:
    
```bash
node examples/submit-bulk-task.js
```

<details>
  <summary>Explanation of submit-bulk-task.json</summary>
  
```
{
  "taskConfig": {
    "options": {
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
- `senderMsg`: the text message that the sender wants to pass to the signer(s)
- `notificantEmail`: the email address of the notificant (who can receive email notifications as well as the final result)
- `notificantLocale`: the language used in email notifications (currently only `en-US` and `zh-TW` are supported)
- `signerInfoList`: the info of each signer, with `phoneNumber` (in international phone number format) an optional field

</details>

You can also replace `task-data/templateData.bin` and `task-data/templateInfo.json` by your own; however, note in the case of bulk send you can only have one signer in the `signerList` field of `templateInfo.json`.

### 3. To verify a confidentially eSigned document

Here are 2 verification modes. In the **semi** mode, in addition to software verification, human eyes are needed to check if the eSigned document matches the original unsigned document. And in the **auto** mode, an additional `BINDING_DATA_HASH`, which is bound to the original unsigned document, needs to be supplied. The `BINDING_DATA_HASH` is computed by Let's eSign API Server and is part of the returned info when submitting the corresponding task to Let's eSign API Server.

```bash
node examples/semi-verify-pdf.js PDF_DOCUMENT SIGNING_PROOF
```

```bash
node examples/auto-verify-pdf.js PDF_DOCUMENT SIGNING_PROOF BINDING_DATA_HASH
```
The `SIGNING_PROOF` is the `.spf` file that accompanies every confidentially eSigned `PDF_DOCUMENT`.
